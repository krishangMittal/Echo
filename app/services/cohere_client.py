"""Cohere embeddings client for semantic memory."""
from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass
from typing import List, Optional, Sequence

import cohere

from app.config import Settings, get_settings
from app.text.chunker import Chunk


@dataclass
class EmbeddingResult:
    """Embedding payload paired with original chunk."""

    chunk: Chunk
    embedding: List[float]
    model: str
    dimension: int


class CohereEmbeddingClient:
    """Cohere embeddings client with batching and retries."""

    def __init__(self, settings: Optional[Settings] = None, max_retries: int = 5, base_backoff: float = 1.5) -> None:
        self._settings = settings or get_settings()
        self._batch_size = self._settings.embed_batch
        self._model = self._settings.embed_model
        self._dimension = self._settings.embed_dim
        self._max_retries = max_retries
        self._base_backoff = base_backoff
        
        if not self._settings.cohere_api_key:
            raise ValueError("COHERE_API_KEY must be set in environment")
        
        self._client = cohere.Client(api_key=self._settings.cohere_api_key)

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

    def embed_text(self, text: str) -> List[float]:
        """Embed a single text string."""
        results = self.embed_texts([text])
        return results[0] if results else []

    def _embed_batch(self, batch: Sequence[Chunk]) -> List[EmbeddingResult]:
        inputs = [chunk.normalized_text for chunk in batch]
        attempt = 0
        
        while True:
            attempt += 1
            try:
                response = self._client.embed(
                    texts=inputs,
                    model=self._model,
                    input_type="search_document"
                )
                
                embeddings = response.embeddings
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
                
            except cohere.errors.TooManyRequestsError:
                if attempt >= self._max_retries:
                    raise
                time.sleep(self._backoff(attempt))
                
            except (cohere.errors.CohereAPIError, cohere.errors.CohereConnectionError) as exc:
                if attempt >= self._max_retries:
                    raise
                # Retry on server errors
                if hasattr(exc, 'status_code') and exc.status_code >= 500:
                    time.sleep(self._backoff(attempt))
                else:
                    raise

    def _backoff(self, attempt: int) -> float:
        return min(30.0, self._base_backoff * (2 ** (attempt - 1)))
