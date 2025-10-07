"""Memory subsystem for Pinecone-backed semantic persistence."""

from app.memory.pinecone_store import PineconeMemoryStore, MemoryRecord, MemorySpeaker

# Legacy imports for compatibility
try:
    from app.memory.store import MemoryStore as LegacyMemoryStore
except ImportError:
    LegacyMemoryStore = None

__all__ = ["PineconeMemoryStore", "MemoryRecord", "MemorySpeaker", "LegacyMemoryStore"]
