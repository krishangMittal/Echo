from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pytest

from app.config import Settings
from app.memory.store import MemoryRecord, MemorySpeaker, MemoryStore


@pytest.fixture()
def temp_settings(tmp_path_factory) -> Settings:
    root = tmp_path_factory.mktemp("lance")
    return Settings(
        lance_db_uri=str(root),
        hot_index_path=root / "hot",
        embed_dim=3,
        chunk_tokens=20,
        chunk_overlap=2,
        min_tokens=1,
        embed_batch=10,
        hot_window_min=10,
    )


def make_record(index: int = 0) -> MemoryRecord:
    return MemoryRecord(
        id=f"record-{index}",
        conv_id="conv-1",
        turn=index,
        speaker=MemorySpeaker.USER,
        ts=datetime.now(timezone.utc),
        raw_text=f"raw chunk {index}",
        normalized_text=f"normalized chunk {index}",
        vector=[0.1, 0.2, 0.3],
        tags=["test"],
        hash=f"hash-{index}",
        source="unit-test",
        embed_model="test-model",
        embed_dim=3,
    )


def test_upsert_idempotent(temp_settings):
    store = MemoryStore(settings=temp_settings)
    record = make_record(1)
    inserted = store.upsert([record])
    assert inserted == 1
    same = make_record(1)
    inserted_again = store.upsert([same])
    assert inserted_again == 0
    records = store.all_records()
    assert len(records) == 1
    assert records[0].hash == record.hash


def test_query_by_id(temp_settings):
    store = MemoryStore(settings=temp_settings)
    record = make_record(2)
    store.upsert([record])
    fetched = store.get_by_ids([record.id])
    assert len(fetched) == 1
    assert fetched[0].id == record.id
