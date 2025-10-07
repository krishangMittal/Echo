"""Application metrics registry."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from threading import Lock
from typing import Dict, Optional

from app.callbacks import CallbackResult


@dataclass
class MetricsSnapshot:
    chunks_ingested: int
    records_upserted: int
    vector_count: int
    last_callback_at: Optional[datetime]
    last_context_push: Optional[datetime]

    def to_dict(self) -> Dict[str, Optional[str]]:
        return {
            "chunks_ingested": self.chunks_ingested,
            "records_upserted": self.records_upserted,
            "vector_count": self.vector_count,
            "last_callback_at": self.last_callback_at.isoformat() if self.last_callback_at else None,
            "last_context_push": self.last_context_push.isoformat() if self.last_context_push else None,
        }


class MetricsRegistry:
    """Thread-safe registry for aggregating core counters."""

    def __init__(self) -> None:
        self._lock = Lock()
        self._chunks_ingested = 0
        self._records_upserted = 0
        self._last_callback_at: Optional[datetime] = None
        self._last_context_push: Optional[datetime] = None

    def record_callback(self, result: CallbackResult, hot_metrics=None) -> None:
        """Record callback metrics (hot_metrics parameter kept for compatibility)"""
        with self._lock:
            self._chunks_ingested += result.ingested_chunks
            self._records_upserted += result.stored_records
            self._last_callback_at = datetime.now(timezone.utc)

    def record_context_push(self, timestamp: datetime) -> None:
        with self._lock:
            self._last_context_push = timestamp

    def snapshot(self, vector_count: int, hot_metrics=None) -> MetricsSnapshot:
        """Create metrics snapshot (hot_metrics parameter kept for compatibility)"""
        with self._lock:
            return MetricsSnapshot(
                chunks_ingested=self._chunks_ingested,
                records_upserted=self._records_upserted,
                vector_count=vector_count,
                last_callback_at=self._last_callback_at,
                last_context_push=self._last_context_push,
            )
