"""In-memory hot index powered by hnswlib for low-latency recall."""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable, List, Optional, Sequence, Tuple

import hnswlib
import numpy as np

from app.config import Settings, get_settings
from app.memory.store import MemoryRecord, MemoryStore

logger = logging.getLogger(__name__)


@dataclass
class HotIndexMetrics:
    """Operational metrics for the hot index."""

    size: int = 0
    last_rebuild: Optional[datetime] = None
    last_eviction: Optional[datetime] = None

    def to_json(self) -> dict:
        return {
            "size": self.size,
            "last_rebuild": self.last_rebuild.isoformat() if self.last_rebuild else None,
            "last_eviction": self.last_eviction.isoformat() if self.last_eviction else None,
        }


class HotIndexManager:
    """Manage a hot hnswlib index synced with the LanceDB-backed store."""

    def __init__(
        self,
        store: MemoryStore,
        settings: Optional[Settings] = None,
        persist_metadata: bool = True,
    ) -> None:
        self._settings = settings or get_settings()
        self._store = store
        self._index = hnswlib.Index(space="cosine", dim=self._settings.embed_dim)
        self._initialized = False
        self._next_label = 0
        self._free_labels: List[int] = []
        self._records: dict[int, MemoryRecord] = {}
        self._id_to_label: dict[str, int] = {}
        self._hash_to_label: dict[str, int] = {}
        self._metrics = HotIndexMetrics()
        self._persist_metadata = persist_metadata
        self._metadata_path = Path(self._settings.hot_index_path) / "metadata.json"
        if self._persist_metadata:
            self._metadata_path.parent.mkdir(parents=True, exist_ok=True)

    @property
    def metrics(self) -> HotIndexMetrics:
        return self._metrics

    @property
    def size(self) -> int:
        return self._metrics.size

    def warm_start(self) -> int:
        """Populate the hot index from the most recent conversation history."""
        window = self._settings.hot_window_min
        records = self._store.latest_within(window)
        logger.info("Warming hot index with %d records from the last %d minutes", len(records), window)
        self.rebuild(records)
        return len(records)

    def rebuild(self, records: Sequence[MemoryRecord]) -> None:
        """Rebuild the hnsw index from scratch using the provided records."""
        self._index = hnswlib.Index(space="cosine", dim=self._settings.embed_dim)
        self._initialized = False
        self._next_label = 0
        self._free_labels.clear()
        self._records.clear()
        self._id_to_label.clear()
        self._hash_to_label.clear()
        if records:
            self.add_or_update(records)
        self._metrics.size = len(self._records)
        self._metrics.last_rebuild = datetime.now(timezone.utc)
        self._write_metadata()

    def add_or_update(self, records: Iterable[MemoryRecord]) -> int:
        payload = list(records)
        if not payload:
            return 0
        total_expected = len(self._records) + len(payload)
        self._ensure_initialized(total_expected + 16)
        vectors: List[np.ndarray] = []
        labels: List[int] = []
        valid_records: List[MemoryRecord] = []
        for record in payload:
            vector_arr = np.asarray(record.vector, dtype=np.float32)
            if vector_arr.shape[0] != self._settings.embed_dim:
                logger.warning(
                    "Skipping record %s due to vector dim %s != expected %s",
                    record.id,
                    vector_arr.shape,
                    self._settings.embed_dim,
                )
                continue
            label = self._id_to_label.get(record.id)
            if label is None:
                label = self._hash_to_label.get(record.hash)
            if label is None:
                label = self._allocate_label()
            self._records[label] = record
            self._id_to_label[record.id] = label
            self._hash_to_label[record.hash] = label
            vectors.append(vector_arr)
            labels.append(label)
            valid_records.append(record)
        if not vectors:
            return 0
        batch = np.stack(vectors)
        self._index.add_items(batch, labels, replace_deleted=True)
        self._metrics.size = len(self._records)
        self._write_metadata()
        return len(valid_records)

    def evict_older_than(self, cutoff: datetime) -> int:
        """Remove entries older than the cutoff timestamp."""
        if not self._records:
            return 0
        evicted = 0
        cutoff = cutoff.astimezone(timezone.utc)
        for label, record in list(self._records.items()):
            if record.ts < cutoff:
                self._index.mark_deleted(label)
                self._records.pop(label, None)
                self._free_labels.append(label)
                self._id_to_label.pop(record.id, None)
                self._hash_to_label.pop(record.hash, None)
                evicted += 1
        if evicted:
            self._metrics.size = len(self._records)
            self._metrics.last_eviction = datetime.now(timezone.utc)
            self._write_metadata()
        return evicted

    def maintain_hot_window(self) -> int:
        """Evict entries beyond the configured hot window."""
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=self._settings.hot_window_min)
        return self.evict_older_than(cutoff)

    def query(self, vector: Sequence[float], topk: Optional[int] = None) -> List[Tuple[MemoryRecord, float]]:
        """Perform a similarity search returning (record, score) tuples."""
        if not self._initialized or not self._records:
            return []
        k = min(topk or self._settings.topk, len(self._records))
        if k == 0:
            return []
        query_vec = np.asarray(vector, dtype=np.float32)
        labels, distances = self._index.knn_query(query_vec, k=k)
        results: List[Tuple[MemoryRecord, float]] = []
        for label, dist in zip(labels[0], distances[0]):
            record = self._records.get(int(label))
            if record is None:
                continue
            score = max(0.0, 1.0 - float(dist))
            results.append((record, score))
        return results

    def _ensure_initialized(self, capacity: int) -> None:
        if not self._initialized:
            max_elements = max(capacity, 128)
            self._index.init_index(
                max_elements=max_elements,
                ef_construction=self._settings.hnsw_ef_con,
                M=self._settings.hnsw_m,
                allow_replace_deleted=True,
            )
            self._index.set_ef(self._settings.hnsw_ef)
            self._initialized = True
        else:
            current_max = self._index.get_max_elements()
            if capacity > current_max:
                new_capacity = max(capacity, int(current_max * 1.5))
                self._index.resize_index(new_capacity)

    def _allocate_label(self) -> int:
        if self._free_labels:
            return self._free_labels.pop()
        label = self._next_label
        self._next_label += 1
        capacity_needed = label + 1
        if self._initialized:
            current_max = self._index.get_max_elements()
            if capacity_needed > current_max:
                new_capacity = max(capacity_needed, int(current_max * 1.5))
                self._index.resize_index(new_capacity)
        return label

    def _write_metadata(self) -> None:
        if not self._persist_metadata:
            return
        payload = self._metrics.to_json()
        try:
            self._metadata_path.write_text(json.dumps(payload, indent=2))
        except Exception as exc:
            logger.debug("Failed to persist hot index metadata: %s", exc)
