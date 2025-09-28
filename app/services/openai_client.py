"""OpenAI embeddings client with retry logic and chunk batching."""
from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass
from typing import Iterable, List, Optional, Sequence

from app.config import Settings, get_settings
from app.text.chunker import Chunk

try:  # pragma: no cover - import detection
    from openai import APIConnectionError, APIError, OpenAI, RateLimitError, Timeout
    _LEGACY_OPENAI = False
except ImportError:  # pragma: no cover - legacy fallback
    import openai
    from openai import error as openai_error

    OpenAI = None  # type: ignore
    APIConnectionError = openai_error.APIConnectionError  # type: ignore[attr-defined]
    APIError = openai_error.APIError  # type: ignore[attr-defined]
    RateLimitError = openai_error.RateLimitError  # type: ignore[attr-defined]
    Timeout = openai_error.Timeout  # type: ignore[attr-defined]
    _LEGACY_OPENAI = True


@dataclass
class EmbeddingResult:
    """Embedding payload paired with original chunk."""

    chunk: Chunk
    embedding: List[float]
    model: str
    dimension: int


class OpenAIEmbeddingClient:
    """Thin wrapper around OpenAI embeddings with batching and retries."""

    def __init__(self, settings: Optional[Settings] = None, max_retries: int = 5, base_backoff: float = 1.5) -> None:
        self._settings = settings or get_settings()
        self._batch_size = self._settings.embed_batch
        self._model = self._settings.embed_model
        self._dimension = self._settings.embed_dim
        self._max_retries = max_retries
        self._base_backoff = base_backoff
        if _LEGACY_OPENAI:
            openai.api_key = self._settings.openai_api_key  # type: ignore[name-defined]
            self._client = None
        else:
            self._client = OpenAI(api_key=self._settings.openai_api_key)

    def embed_chunks(self, chunks: Sequence[Chunk]) -> List[EmbeddingResult]:
        """Embed normalized text chunks and return vectors."""
        results: List[EmbeddingResult] = []
        batch: List[Chunk] = []
        for chunk in chunks:
            if not chunk.normalized_text:
                continue
            batch.append(chunk)
            if len(batch) >= self._batch_size:
                results.extend(self._embed_batch(batch))
                batch.clear()
        if batch:
            results.extend(self._embed_batch(batch))
        return results

    def embed_texts(self, texts: Sequence[str]) -> List[List[float]]:
        """Embed raw strings when chunk metadata is not needed."""
        chunks = [
            Chunk(
                raw_text=text,
                normalized_text=text,
                token_count=0,
                token_start=0,
                hash=hashlib.sha1(text.encode("utf-8")).hexdigest(),
            )
            for text in texts
        ]
        return [result.embedding for result in self.embed_chunks(chunks)]

    def _embed_batch(self, batch: Sequence[Chunk]) -> List[EmbeddingResult]:
        inputs = [chunk.normalized_text for chunk in batch]
        attempt = 0
        while True:
            attempt += 1
            try:
                embeddings = self._call_openai(inputs)
                if len(embeddings) != len(batch):
                    raise RuntimeError("Embedding response size mismatch")
                return [
                    EmbeddingResult(
                        chunk=chunk,
                        embedding=list(embedding),
                        model=self._model,
                        dimension=self._dimension,
                    )
                    for chunk, embedding in zip(batch, embeddings)
                ]
            except (RateLimitError, Timeout):
                if attempt >= self._max_retries:
                    raise
                time.sleep(self._backoff(attempt))
            except (APIError, APIConnectionError) as exc:
                if attempt >= self._max_retries:
                    raise
                if getattr(exc, "status_code", 500) >= 500:
                    time.sleep(self._backoff(attempt))
                else:
                    raise

    def _call_openai(self, inputs: Sequence[str]) -> List[List[float]]:
        if _LEGACY_OPENAI:
            response = openai.Embedding.create(model=self._model, input=list(inputs))  # type: ignore[name-defined]
            data = response["data"]
            return [item["embedding"] for item in data]
        response = self._client.embeddings.create(model=self._model, input=list(inputs))
        return [item.embedding for item in response.data]

    def _backoff(self, attempt: int) -> float:
        return min(30.0, self._base_backoff * (2 ** (attempt - 1)))
