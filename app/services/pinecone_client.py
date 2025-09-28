"""Pinecone client for semantic memory storage and retrieval."""
from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import Dict, List, Optional, Any

from pinecone import Pinecone, ServerlessSpec

from app.config import Settings, get_settings
from app.services.cohere_client import CohereEmbeddingClient

logger = logging.getLogger(__name__)


class PineconeClient:
    """Pinecone client for semantic memory operations."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self._settings = settings or get_settings()
        
        if not self._settings.pinecone_api_key:
            raise ValueError("PINECONE_API_KEY must be set in environment")
        
        self._pc = Pinecone(api_key=self._settings.pinecone_api_key)
        self._index_name = self._settings.pinecone_index
        self._namespace = self._settings.pinecone_namespace
        self._embedding_client = CohereEmbeddingClient(settings)
        
        # Ensure index exists
        self._ensure_index()
        self._index = self._pc.Index(self._index_name)

    def _ensure_index(self) -> None:
        """Create the Pinecone index if it doesn't exist."""
        existing_indexes = [i.name for i in self._pc.list_indexes()]
        
        if self._index_name not in existing_indexes:
            logger.info(f"Creating Pinecone index: {self._index_name}")
            self._pc.create_index(
                name=self._index_name,
                dimension=self._settings.embed_dim,
                metric="cosine",
                spec=ServerlessSpec(
                    cloud=self._settings.pinecone_cloud,
                    region=self._settings.pinecone_region
                ),
            )
            logger.info(f"Successfully created Pinecone index: {self._index_name}")

    def store_semantic_memory(
        self, 
        user_id: str, 
        text: str, 
        context_type: str = "conversation", 
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Store a semantic memory in Pinecone."""
        try:
            # Get embedding
            embedding = self._embedding_client.embed_text(text)
            
            # Prepare metadata
            md = {
                "user_id": user_id,
                "text_content": text,
                "context_type": context_type,
                "timestamp": datetime.now().isoformat(),
                **(metadata or {})
            }
            
            # Generate unique ID
            timestamp_str = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
            vector_id = f"mem_{user_id}_{timestamp_str}"
            
            # Upsert to Pinecone
            self._index.upsert(
                vectors=[{
                    "id": vector_id,
                    "values": embedding,
                    "metadata": md
                }],
                namespace=self._namespace
            )
            
            logger.debug(f"Stored semantic memory for user {user_id}: {vector_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error storing semantic memory: {e}")
            return False

    def search_semantic_memory(
        self, 
        user_id: str, 
        query_text: str, 
        top_k: int = 5, 
        max_distance: Optional[float] = None,
        context_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Search semantic memories for a user."""
        try:
            # Use default max distance if not provided
            if max_distance is None:
                max_distance = self._settings.default_max_distance
            
            # Get query embedding
            query_embedding = self._embedding_client.embed_text(query_text)
            
            # Build metadata filter
            filter_dict = {"user_id": {"$eq": user_id}}
            if context_type:
                filter_dict["context_type"] = {"$eq": context_type}
            
            # Query Pinecone (overfetch to allow for filtering)
            response = self._index.query(
                vector=query_embedding,
                top_k=max(top_k * 3, 10),
                include_metadata=True,
                namespace=self._namespace,
                filter=filter_dict
            )
            
            # Process results and apply distance filtering
            results = []
            for match in response.get("matches", []):
                score = float(match.get("score", 0.0))  # Cosine similarity
                
                # Convert similarity to distance and filter
                # With cosine similarity: distance = 1 - similarity
                if score >= (1.0 - max_distance):
                    metadata = match.get("metadata", {})
                    results.append({
                        "id": match.get("id"),
                        "score": score,
                        "distance": 1.0 - score,
                        "text": metadata.get("text_content"),
                        "context_type": metadata.get("context_type"),
                        "timestamp": metadata.get("timestamp"),
                        "topic": metadata.get("topic"),
                        "emotion": metadata.get("emotion"),
                        "importance": metadata.get("importance"),
                        "extracted_name": metadata.get("extracted_name"),
                        "friend_name": metadata.get("friend_name"),
                        "metadata": metadata,
                    })
            
            # Sort by score (highest first) and limit
            results.sort(key=lambda x: x["score"], reverse=True)
            return results[:top_k]
            
        except Exception as e:
            logger.error(f"Error searching semantic memory: {e}")
            return []

    def search_identity_memories(
        self, 
        user_id: str, 
        query_text: str, 
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """Search for identity-related memories with looser distance threshold."""
        return self.search_semantic_memory(
            user_id=user_id,
            query_text=query_text,
            top_k=top_k,
            max_distance=self._settings.identity_max_distance
        )

    def get_user_profile(self, user_id: str) -> Dict[str, Any]:
        """Get user profile information from stored memories."""
        try:
            # Search for profile/identity information
            profile_results = self.search_semantic_memory(
                user_id=user_id,
                query_text="name identity profile about me",
                top_k=10,
                max_distance=self._settings.identity_max_distance
            )
            
            profile = {
                "user_id": user_id,
                "extracted_name": None,
                "friend_names": [],
                "topics": [],
                "recent_emotions": []
            }
            
            for result in profile_results:
                metadata = result.get("metadata", {})
                
                # Extract name information
                if metadata.get("extracted_name") and not profile["extracted_name"]:
                    profile["extracted_name"] = metadata["extracted_name"]
                
                # Collect friend names
                if metadata.get("friend_name"):
                    friend_name = metadata["friend_name"]
                    if friend_name not in profile["friend_names"]:
                        profile["friend_names"].append(friend_name)
                
                # Collect topics
                if metadata.get("topic"):
                    topic = metadata["topic"]
                    if topic not in profile["topics"]:
                        profile["topics"].append(topic)
                
                # Collect emotions
                if metadata.get("emotion"):
                    emotion = metadata["emotion"]
                    if emotion not in profile["recent_emotions"]:
                        profile["recent_emotions"].append(emotion)
            
            return profile
            
        except Exception as e:
            logger.error(f"Error getting user profile: {e}")
            return {"user_id": user_id, "error": str(e)}

    def delete_user_memories(self, user_id: str) -> bool:
        """Delete all memories for a specific user."""
        try:
            # Note: Pinecone doesn't support deleting by metadata filter directly
            # We need to query first, then delete by IDs
            all_memories = self.search_semantic_memory(
                user_id=user_id,
                query_text="",  # Empty query to get all
                top_k=10000,  # Large number to get all memories
                max_distance=1.0  # Max distance to get everything
            )
            
            if all_memories:
                ids_to_delete = [memory["id"] for memory in all_memories]
                self._index.delete(ids=ids_to_delete, namespace=self._namespace)
                logger.info(f"Deleted {len(ids_to_delete)} memories for user {user_id}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error deleting user memories: {e}")
            return False

    def get_index_stats(self) -> Dict[str, Any]:
        """Get statistics about the Pinecone index."""
        try:
            stats = self._index.describe_index_stats()
            return {
                "total_vector_count": stats.get("total_vector_count", 0),
                "namespaces": stats.get("namespaces", {}),
                "dimension": stats.get("dimension", 0),
                "index_fullness": stats.get("index_fullness", 0.0)
            }
        except Exception as e:
            logger.error(f"Error getting index stats: {e}")
            return {"error": str(e)}
