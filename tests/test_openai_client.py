from app.config import Settings
from app.services.openai_client import EmbeddingResult, OpenAIEmbeddingClient
from app.text.chunker import Chunk


def test_embedding_client_batches(monkeypatch):
    settings = Settings(embed_batch=2, embed_dim=3, openai_api_key="sk-test")

    class DummyClient:
        pass

    monkeypatch.setattr("app.services.openai_client.OpenAI", lambda api_key=None: DummyClient())

    client = OpenAIEmbeddingClient(settings=settings)

    calls = []

    def fake_call(inputs):
        calls.append(list(inputs))
        return [[float(i + idx) for i in range(settings.embed_dim)] for idx, _ in enumerate(inputs)]

    monkeypatch.setattr(client, "_call_openai", fake_call)
    chunks = [
        Chunk(raw_text=str(i), normalized_text=str(i), token_count=0, token_start=0, hash=f"h{i}")
        for i in range(5)
    ]
    results = client.embed_chunks(chunks)
    assert len(results) == 5
    assert len(calls) == 3  # ceiling(5/2)
    assert all(isinstance(res, EmbeddingResult) for res in results)
