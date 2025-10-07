from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.config import Settings
from app.memory.index import HotIndexManager
from app.memory.store import MemoryRecord, MemorySpeaker, MemoryStore


def build_settings(tmp_path, window: int = 1) -> Settings:
    return Settings(
        lance_db_uri=str(tmp_path),
        hot_index_path=tmp_path / "hot",
        embed_dim=3,
        chunk_tokens=20,
        chunk_overlap=2,
        min_tokens=1,
        embed_batch=5,
        hot_window_min=window,
    )


def make_record(ts: datetime, idx: int) -> MemoryRecord:
    return MemoryRecord(
        id=f"rec-{idx}",
        conv_id="conv",
        turn=idx,
        speaker=MemorySpeaker.USER,
        ts=ts,
        raw_text=f"chunk {idx}",
        normalized_text=f"chunk {idx}",
        vector=[0.1, 0.2, 0.3],
        tags=[],
        hash=f"hash-{idx}",
        source="unit",
        embed_model="test",
        embed_dim=3,
    )


def test_eviction(tmp_path):
    settings = build_settings(tmp_path)
    store = MemoryStore(settings=settings)
    hot_index = HotIndexManager(store, settings=settings, persist_metadata=False)
    recent = make_record(datetime.now(timezone.utc), 1)
    old = make_record(datetime.now(timezone.utc) - timedelta(minutes=5), 2)
    store.upsert([recent, old])
    hot_index.add_or_update([recent, old])
    assert hot_index.size >= 2
    evicted = hot_index.maintain_hot_window()
    assert evicted >= 1
    assert hot_index.size <= 1
