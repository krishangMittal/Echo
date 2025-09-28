"""Pinecone-backed persistence layer for conversation memory."""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional, Sequence, Dict, Any
from uuid import uuid4

from app.config import Settings, get_settings
from app.services.pinecone_client import PineconeClient

logger = logging.getLogger(__name__)

MEMORY_SCHEMA_VERSION = "2.0"


class MemorySpeaker(str, Enum):
    """Speaker roles captured in the memory store."""

    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    OTHER = "other"


@dataclass
class MemoryRecord:
    """In-memory representation of a Pinecone vector with metadata."""

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
    user_id: str = ""

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

    def to_pinecone_metadata(self) -> Dict[str, Any]:
        """Return Pinecone-compatible metadata dict."""
        return {
            "id": self.id,
            "conv_id": self.conv_id,
            "turn": int(self.turn),
            "speaker": self.speaker.value,
            "timestamp": self.ts.isoformat(),
            "raw_text": self.raw_text,
            "normalized_text": self.normalized_text,
            "text_content": self.normalized_text,  # For search compatibility
            "tags": list(self.tags),
            "hash": self.hash,
            "source": self.source,
            "embed_model": self.embed_model,
            "embed_dim": int(self.embed_dim),
            "user_id": self.user_id,
            "context_type": "conversation",
        }

    @classmethod
    def from_pinecone_result(cls, result: Dict[str, Any]) -> "MemoryRecord":
        """Rehydrate a MemoryRecord from a Pinecone search result."""
        metadata = result.get("metadata", {})
        
        # Parse timestamp
        ts_str = metadata.get("timestamp")
        if ts_str:
            try:
                ts = datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
            except ValueError:
                ts = datetime.now(timezone.utc)
        else:
            ts = datetime.now(timezone.utc)
        
        # Parse speaker
        speaker_value = metadata.get("speaker", MemorySpeaker.OTHER.value)
        try:
            speaker = MemorySpeaker(speaker_value)
        except ValueError:
            speaker = MemorySpeaker.OTHER
        
        return cls(
            id=metadata.get("id", str(uuid4())),
            conv_id=metadata.get("conv_id", ""),
            turn=metadata.get("turn", 0),
            speaker=speaker,
            ts=ts,
            raw_text=metadata.get("raw_text", ""),
            normalized_text=metadata.get("normalized_text", metadata.get("text_content", "")),
            vector=result.get("vector", []),  # Usually not returned in search results
            tags=metadata.get("tags", []) or [],
            hash=metadata.get("hash", ""),
            source=metadata.get("source", ""),
            embed_model=metadata.get("embed_model", ""),
            embed_dim=metadata.get("embed_dim", 0),
            user_id=metadata.get("user_id", ""),
        )


class PineconeMemoryStore:
    """Facade for Pinecone operations tied to conversation memory."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self._settings = settings or get_settings()
        self._client = PineconeClient(settings)
        self._existing_hashes: Dict[str, bool] = {}  # Cache for deduplication

    def upsert(self, records: Sequence[MemoryRecord]) -> int:
        """Insert or update records idempotently by their content hash."""
        if not records:
            return 0
        
        stored_count = 0
        for record in records:
            # Check if we've already stored this hash (simple deduplication)
            if record.hash in self._existing_hashes:
                continue
            
            # Store in Pinecone
            success = self._client.store_semantic_memory(
                user_id=record.user_id,
                text=record.normalized_text,
                context_type="conversation",
                metadata=record.to_pinecone_metadata()
            )
            
            if success:
                self._existing_hashes[record.hash] = True
                stored_count += 1
        
        return stored_count

    def search_by_text(
        self, 
        user_id: str, 
        query_text: str, 
        top_k: int = 5,
        max_distance: Optional[float] = None
    ) -> List[MemoryRecord]:
        """Search memories by semantic similarity."""
        results = self._client.search_semantic_memory(
            user_id=user_id,
            query_text=query_text,
            top_k=top_k,
            max_distance=max_distance
        )
        
        return [MemoryRecord.from_pinecone_result(result) for result in results]

    def get_user_profile(self, user_id: str) -> Dict[str, Any]:
        """Get user profile information."""
        return self._client.get_user_profile(user_id)

    def delete_user_memories(self, user_id: str) -> bool:
        """Delete all memories for a user."""
        success = self._client.delete_user_memories(user_id)
        if success:
            # Clear hash cache for this user (simple approach)
            self._existing_hashes.clear()
        return success

    def get_stats(self) -> Dict[str, Any]:
        """Get memory store statistics."""
        return self._client.get_index_stats()

    # Legacy compatibility methods (simplified versions)
    def latest_within(self, minutes: int, limit: Optional[int] = None, user_id: Optional[str] = None) -> List[MemoryRecord]:
        """Return recent records (simplified - uses search instead of time filtering)."""
        if not user_id:
            logger.warning("latest_within requires user_id for Pinecone implementation")
            return []
        
        # Use a broad search to get recent memories
        results = self._client.search_semantic_memory(
            user_id=user_id,
            query_text="recent conversation",
            top_k=limit or 20,
            max_distance=0.8  # Very loose to get more results
        )
        
        return [MemoryRecord.from_pinecone_result(result) for result in results]

    def get_by_ids(self, ids: Sequence[str], user_id: str) -> List[MemoryRecord]:
        """Fetch records by their identifiers (limited support in Pinecone)."""
        # Pinecone doesn't have a direct get-by-id operation for vectors
        # This is a simplified implementation
        logger.warning("get_by_ids has limited support with Pinecone backend")
        return []

    def latest_for_conversation(self, conversation_id: str, user_id: str, limit: Optional[int] = None) -> List[MemoryRecord]:
        """Return recent records for a conversation."""
        # Search for memories with this conversation ID
        results = self._client.search_semantic_memory(
            user_id=user_id,
            query_text=f"conversation {conversation_id}",
            top_k=limit or 20,
            max_distance=0.8
        )
        
        # Filter by conversation ID if available in metadata
        filtered_results = []
        for result in results:
            metadata = result.get("metadata", {})
            if metadata.get("conv_id") == conversation_id:
                filtered_results.append(MemoryRecord.from_pinecone_result(result))
        
        return filtered_results

    def all_records(self, user_id: str, limit: Optional[int] = None) -> List[MemoryRecord]:
        """Return all records for a user (use cautiously)."""
        results = self._client.search_semantic_memory(
            user_id=user_id,
            query_text="",  # Empty query
            top_k=limit or 1000,
            max_distance=1.0  # Maximum distance to get everything
        )
        
        return [MemoryRecord.from_pinecone_result(result) for result in results]
