"""Application state wiring and dependency container."""
from __future__ import annotations

import logging
from dataclasses import dataclass

from app.callbacks import CallbackProcessor
from app.config import Settings
from app.memory.index import HotIndexManager
from app.memory.store import MemoryStore
from app.metrics import MetricsRegistry
from app.services.herdora_vision import HerdoraVisionClient
from app.services.openai_client import OpenAIEmbeddingClient
from app.text.chunker import TextChunker

logger = logging.getLogger(__name__)


@dataclass
class AppState:
    settings: Settings
    memory_store: MemoryStore
    hot_index: HotIndexManager
    chunker: TextChunker
    embeddings: OpenAIEmbeddingClient
    vision: HerdoraVisionClient
    callback_processor: CallbackProcessor
    metrics: MetricsRegistry

    @classmethod
    def build(cls) -> "AppState":
        settings = Settings()
        chunker = TextChunker(settings=settings)
        embeddings = OpenAIEmbeddingClient(settings=settings)
        vision = HerdoraVisionClient(settings=settings)
        memory_store = MemoryStore(settings=settings)
        hot_index = HotIndexManager(memory_store, settings=settings)
        try:
            hot_index.warm_start()
        except Exception as exc:
            logger.warning("Failed to warm start hot index: %s", exc)
        callback_processor = CallbackProcessor(
            memory_store=memory_store,
            hot_index=hot_index,
            chunker=chunker,
            embeddings=embeddings,
            settings=settings,
        )
        metrics = MetricsRegistry()
        return cls(
            settings=settings,
            memory_store=memory_store,
            hot_index=hot_index,
            chunker=chunker,
            embeddings=embeddings,
            vision=vision,
            callback_processor=callback_processor,
            metrics=metrics,
        )
