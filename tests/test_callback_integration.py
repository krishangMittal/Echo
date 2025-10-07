from __future__ import annotations

import hashlib
import hmac
import json
from datetime import datetime, timezone

from app.callbacks import CallbackProcessor
from app.config import Settings
from app.memory.index import HotIndexManager
from app.memory.store import MemoryStore
from app.services.openai_client import EmbeddingResult
from app.text.chunker import TextChunker


class FakeEmbeddingClient:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def embed_chunks(self, chunks):
        vectors = []
        for idx, chunk in enumerate(chunks):
            vector = [float(idx + 1)] * self._settings.embed_dim
            vectors.append(
                EmbeddingResult(
                    chunk=chunk,
                    embedding=vector,
                    model=self._settings.embed_model,
                    dimension=self._settings.embed_dim,
                )
            )
        return vectors


def sign(secret: str, body: bytes, timestamp: int) -> str:
    message = f"{timestamp}.".encode("utf-8") + body
    return hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()


def build_settings(tmp_path) -> Settings:
    return Settings(
        lance_db_uri=str(tmp_path / "memory"),
        hot_index_path=tmp_path / "hot",
        embed_dim=3,
        embed_batch=5,
        chunk_tokens=50,
        chunk_overlap=5,
        min_tokens=1,
        hot_window_min=10,
        ingest_webhook_secret="secret",
        openai_api_key="sk-test",
    )


def test_callback_pipeline(tmp_path):
    settings = build_settings(tmp_path)
    chunker = TextChunker(settings=settings)
    store = MemoryStore(settings=settings)
    hot_index = HotIndexManager(store, settings=settings, persist_metadata=False)
    embeddings = FakeEmbeddingClient(settings)
    processor = CallbackProcessor(
        memory_store=store,
        hot_index=hot_index,
        chunker=chunker,
        embeddings=embeddings,
        settings=settings,
    )

    payload = {
        "conversation_id": "conv-123",
        "turn": 1,
        "speaker": "user",
        "text": "Hello Echo, memory integration test message.",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "tags": ["integration"],
        "source": "test",
    }
    body = json.dumps(payload).encode("utf-8")
    timestamp = int(datetime.now(timezone.utc).timestamp())
    header = f"t={timestamp},v1={sign(settings.ingest_webhook_secret, body, timestamp)}"

    result = processor.process(body, header)

    assert result.stored_records > 0
    records = store.all_records()
    assert len(records) == result.stored_records
    query_results = hot_index.query(records[0].vector, topk=1)
    assert query_results
    top_record, _ = query_results[0]
    assert top_record.conv_id == payload["conversation_id"]
