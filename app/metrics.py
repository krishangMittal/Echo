"""Application metrics registry."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from threading import Lock
from typing import Dict, Optional

from app.memory.index import HotIndexMetrics
from app.callbacks import CallbackResult


@dataclass
class MetricsSnapshot:
    chunks_ingested: int
    records_upserted: int
    lance_rows: int
    index_size: int
    last_callback_at: Optional[datetime]
    last_context_push: Optional[datetime]
    last_eviction: Optional[datetime]
    last_rebuild: Optional[datetime]

    def to_dict(self) -> Dict[str, Optional[str]]:
        return {
            "chunks_ingested": self.chunks_ingested,
            "records_upserted": self.records_upserted,
            "lance_rows": self.lance_rows,
            "index_size": self.index_size,
            "last_callback_at": self.last_callback_at.isoformat() if self.last_callback_at else None,
            "last_context_push": self.last_context_push.isoformat() if self.last_context_push else None,
            "last_eviction": self.last_eviction.isoformat() if self.last_eviction else None,
            "last_rebuild": self.last_rebuild.isoformat() if self.last_rebuild else None,
        }


class MetricsRegistry:
    """Thread-safe registry for aggregating core counters."""

    def __init__(self) -> None:
        self._lock = Lock()
        self._chunks_ingested = 0
        self._records_upserted = 0
        self._last_callback_at: Optional[datetime] = None
        self._last_context_push: Optional[datetime] = None
        self._last_eviction: Optional[datetime] = None
        self._last_rebuild: Optional[datetime] = None

    def record_callback(self, result: CallbackResult, hot_metrics: HotIndexMetrics) -> None:
        with self._lock:
            self._chunks_ingested += result.ingested_chunks
            self._records_upserted += result.stored_records
            self._last_callback_at = datetime.now(timezone.utc)
            if hot_metrics.last_eviction:
                self._last_eviction = hot_metrics.last_eviction
            if hot_metrics.last_rebuild:
                self._last_rebuild = hot_metrics.last_rebuild

    def record_context_push(self, timestamp: datetime) -> None:
        with self._lock:
            self._last_context_push = timestamp

    def snapshot(self, lance_rows: int, hot_metrics: HotIndexMetrics) -> MetricsSnapshot:
        with self._lock:
            return MetricsSnapshot(
                chunks_ingested=self._chunks_ingested,
                records_upserted=self._records_upserted,
                lance_rows=lance_rows,
                index_size=hot_metrics.size,
                last_callback_at=self._last_callback_at,
                last_context_push=self._last_context_push,
                last_eviction=hot_metrics.last_eviction or self._last_eviction,
                last_rebuild=hot_metrics.last_rebuild or self._last_rebuild,
            )
