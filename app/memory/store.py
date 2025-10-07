"""LanceDB-backed persistence layer for conversation memory."""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Iterable, List, Optional, Sequence
from uuid import uuid4

import lancedb
import pyarrow as pa
import pyarrow.dataset as ds

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)

MEMORY_SCHEMA_VERSION = "1.0"


class MemorySpeaker(str, Enum):
    """Speaker roles captured in the memory store."""

    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    OTHER = "other"


@dataclass
class MemoryRecord:
    """In-memory representation of a LanceDB row."""

    conv_id: str
    turn: int
    speaker: MemorySpeaker
    ts: datetime
    raw_text: str
    normalized_text: str
    vector: Sequence[float]
    tags: Sequence[str] = field(default_factory=list)
    hash: str = ""
    source: str = "ingest"
    embed_model: str = ""
    embed_dim: int = 0
    id: str = field(default_factory=lambda: str(uuid4()))

    def __post_init__(self) -> None:
        if self.hash == "":
            raise ValueError("MemoryRecord.hash must be provided for idempotent upserts")
        if self.embed_model == "":
            raise ValueError("MemoryRecord.embed_model must be provided")
        if not isinstance(self.ts, datetime):
            raise TypeError("MemoryRecord.ts must be a datetime")
        if self.ts.tzinfo is None:
            # Default to UTC for naive datetimes
            self.ts = self.ts.replace(tzinfo=timezone.utc)
        else:
            self.ts = self.ts.astimezone(timezone.utc)

    def to_dict(self) -> dict:
        """Return a Lance-compatible dict."""
        return {
            "id": self.id,
            "conv_id": self.conv_id,
            "turn": int(self.turn),
            "speaker": self.speaker.value,
            "ts": self.ts,
            "raw_text": self.raw_text,
            "normalized_text": self.normalized_text,
            "vector": list(self.vector),
            "tags": list(self.tags),
            "hash": self.hash,
            "source": self.source,
            "embed_model": self.embed_model,
            "embed_dim": int(self.embed_dim),
        }

    @classmethod
    def from_row(cls, row: dict) -> "MemoryRecord":
        """Rehydrate a MemoryRecord from a Lance row."""
        ts = row.get("ts")
        if isinstance(ts, datetime) and ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        speaker_value = row.get("speaker", MemorySpeaker.OTHER.value)
        try:
            speaker = MemorySpeaker(speaker_value)
        except ValueError:
            speaker = MemorySpeaker.OTHER
        return cls(
            id=row.get("id"),
            conv_id=row.get("conv_id", ""),
            turn=row.get("turn", 0),
            speaker=speaker,
            ts=ts or datetime.now(timezone.utc),
            raw_text=row.get("raw_text", ""),
            normalized_text=row.get("normalized_text", ""),
            vector=row.get("vector", []) or [],
            tags=row.get("tags", []) or [],
            hash=row.get("hash", ""),
            source=row.get("source", ""),
            embed_model=row.get("embed_model", ""),
            embed_dim=row.get("embed_dim", 0),
        )


class MemoryStore:
    """Facade for LanceDB operations tied to conversation memory."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self._settings = settings or get_settings()
        db_uri = self._settings.lance_db_uri
        if "://" not in db_uri:
            self._settings.lance_db_path.mkdir(parents=True, exist_ok=True)
        self._conn = lancedb.connect(db_uri)
        self._table = self._ensure_table()
        self._ensure_metadata()

    @property
    def table(self):
        return self._table

    def _ensure_table(self):
        schema = self._build_schema()
        table_name = self._settings.lance_table_name
        existing_tables = set(self._conn.table_names())
        if table_name in existing_tables:
            table = self._conn.open_table(table_name)
            return table
        logger.info("Creating Lance table '%s'", table_name)
        try:
            # Prefer newer API that supports declaring a primary key
            return self._conn.create_table(
                table_name,
                schema=schema,
                primary_key="hash",
            )
        except TypeError:
            # Older LanceDB versions do not support the 'primary_key' argument
            return self._conn.create_table(
                table_name,
                schema=schema,
            )

    def _build_schema(self) -> pa.Schema:
        return pa.schema(
            [
                pa.field("id", pa.string()),
                pa.field("conv_id", pa.string()),
                pa.field("turn", pa.int64()),
                pa.field("speaker", pa.string()),
                pa.field("ts", pa.timestamp("us", tz="UTC")),
                pa.field("raw_text", pa.string()),
                pa.field("normalized_text", pa.string()),
                pa.field("vector", pa.list_(pa.float32())),
                pa.field("tags", pa.list_(pa.string())),
                pa.field("hash", pa.string()),
                pa.field("source", pa.string()),
                pa.field("embed_model", pa.string()),
                pa.field("embed_dim", pa.int32()),
            ]
        )

    def _ensure_metadata(self) -> None:
        metadata_payload = {"memory_schema_version": MEMORY_SCHEMA_VERSION}
        try:
            write_metadata = getattr(self._table, "write_metadata")
            read_metadata = getattr(self._table, "metadata", lambda: {})
            existing = read_metadata() or {}
            if existing.get("memory_schema_version") != MEMORY_SCHEMA_VERSION:
                write_metadata(metadata_payload)
        except AttributeError:
            logger.debug("Lance metadata API unavailable; skipping schema version stamp")
        except Exception as exc:
            logger.warning("Unable to persist Lance metadata: %s", exc)

    def upsert(self, records: Iterable[MemoryRecord]) -> int:
        """Insert or update records idempotently by their content hash."""
        payload = [record.to_dict() for record in records]
        if not payload:
            return 0
        # Prefer explicit idempotent behavior for broad LanceDB compatibility
        existing_hashes = self._existing_hashes([row["hash"] for row in payload])
        pending = [row for row in payload if row["hash"] not in existing_hashes]
        if not pending:
            return 0
        self._table.add(pending)
        return len(pending)

    def latest_within(self, minutes: int, limit: Optional[int] = None) -> List[MemoryRecord]:
        """Return records within the last N minutes sorted chronologically."""
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=minutes)
        dataset = self._table.to_lance()
        cutoff_scalar = pa.scalar(cutoff, type=pa.timestamp("ms", tz="UTC"))
        filter_expr = ds.field("ts") >= cutoff_scalar
        table = dataset.to_table(filter=filter_expr)
        if table.num_rows == 0:
            return []
        table = table.sort_by([("ts", "ascending"), ("turn", "ascending")])
        records = [MemoryRecord.from_row(row) for row in table.to_pylist()]
        if limit is not None:
            return records[-limit:]
        return records

    def get_by_ids(self, ids: Sequence[str]) -> List[MemoryRecord]:
        """Fetch records by their UUID identifiers."""
        if not ids:
            return []
        dataset = self._table.to_lance()
        filter_expr = ds.field("id").isin(list(ids))
        table = dataset.to_table(filter=filter_expr)
        if table.num_rows == 0:
            return []
        return [MemoryRecord.from_row(row) for row in table.to_pylist()]

    def latest_for_conversation(self, conversation_id: str, limit: Optional[int] = None) -> List[MemoryRecord]:
        """Return recent records for a conversation ordered by time then turn."""
        dataset = self._table.to_lance()
        filter_expr = ds.field("conv_id") == conversation_id
        table = dataset.to_table(filter=filter_expr)
        if table.num_rows == 0:
            return []
        table = table.sort_by([("ts", "ascending"), ("turn", "ascending")])
        records = [MemoryRecord.from_row(row) for row in table.to_pylist()]
        if limit is not None:
            return records[-limit:]
        return records

    def _existing_hashes(self, hashes: Sequence[str]) -> set[str]:
        if not hashes:
            return set()
        dataset = self._table.to_lance()
        filter_expr = ds.field("hash").isin(list(hashes))
        table = dataset.to_table(columns=["hash"], filter=filter_expr)
        if table.num_rows == 0:
            return set()
        return set(table.column("hash").to_pylist())

    def all_records(self, limit: Optional[int] = None) -> List[MemoryRecord]:
        """Return all records from LanceDB (use cautiously for large datasets)."""
        dataset = self._table.to_lance()
        table = dataset.to_table()
        records = [MemoryRecord.from_row(row) for row in table.to_pylist()]
        if limit is not None:
            return records[:limit]
        return records
