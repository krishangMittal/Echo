"""Application state wiring and dependency container."""
from __future__ import annotations

import logging
from dataclasses import dataclass

from app.callbacks import CallbackProcessor
from app.config import Settings
from app.memory import PineconeMemoryStore
from app.metrics import MetricsRegistry
from app.services.cohere_client import CohereEmbeddingClient
from app.text.chunker import TextChunker

logger = logging.getLogger(__name__)


@dataclass
class AppState:
    settings: Settings
    memory_store: PineconeMemoryStore
    chunker: TextChunker
    embeddings: CohereEmbeddingClient
    callback_processor: CallbackProcessor
    metrics: MetricsRegistry

    @classmethod
    def build(cls) -> "AppState":
        settings = Settings()
        chunker = TextChunker(settings=settings)
        embeddings = CohereEmbeddingClient(settings=settings)
        memory_store = PineconeMemoryStore(settings=settings)
        
        callback_processor = CallbackProcessor(
            memory_store=memory_store,
            chunker=chunker,
            embeddings=embeddings,
            settings=settings,
        )
        metrics = MetricsRegistry()
        return cls(
            settings=settings,
            memory_store=memory_store,
            chunker=chunker,
            embeddings=embeddings,
            callback_processor=callback_processor,
            metrics=metrics,
        )
