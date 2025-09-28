#!/usr/bin/env python3
"""
🚀 AURORA TAVUS + PINECONE INTEGRATION
Real-time processing with Pinecone semantic memory
"""

import os
import requests
import json
from datetime import datetime
from typing import Dict, List, Optional, Any
from dotenv import load_dotenv
from openai import OpenAI
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# Import our Pinecone-based memory system
from app.services.pinecone_client import PineconeClient
from app.services.cohere_client import CohereEmbeddingClient
from app.config import get_settings

load_dotenv()

# ============================================================================
# CONFIGURATION
# ============================================================================

TAVUS_API_KEY = os.getenv("TAVUS_API_KEY")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
BASE_URL = "https://tavusapi.com/v2"

# Initialize clients
settings = get_settings()
pinecone_client = PineconeClient(settings)
embedding_client = CohereEmbeddingClient(settings)

# Initialize DeepSeek client
deepseek_client = OpenAI(
    api_key=DEEPSEEK_API_KEY,
    base_url="https://api.deepseek.com"
)

# Live metrics that update in real-time
live_metrics = {
    "relationship_level": 25.0,
    "trust_level": 35.0,
    "emotional_sync": 45.0,
    "memory_depth": 15.0,
    "current_emotion": "neutral",
    "current_topic": "general",
    "insights_count": 0,
    "conversation_turns": 0,
    "recent_insights": [],
    "conversation_active": False,
    "last_updated": datetime.now().isoformat()
}

# Store processed speeches
processed_speeches = []

# ============================================================================
# FASTAPI APP SETUP
# ============================================================================

app = FastAPI(title="Aurora Tavus Pinecone Integration")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# PINECONE MEMORY FUNCTIONS
# ============================================================================

def store_semantic_memory(user_id: str, text: str, context_type: str = "conversation", metadata: Dict = None):
    """Store semantic memory using Pinecone"""
    try:
        # Extract context information
        extracted_name = extract_name_from_speech(text) if "name" in text.lower() else None
        friend_name = extract_friend_name(text) if "friend" in text.lower() or "buddy" in text.lower() else None
        
        # Determine topic and emotion (simplified - could use DeepSeek for this)
        topic = metadata.get('topic', 'general') if metadata else 'general'
        emotion = metadata.get('emotion', 'neutral') if metadata else 'neutral'
        importance = metadata.get('importance', 5.0) if metadata else 5.0
        
        # Enhanced metadata
        enhanced_metadata = {
            "topic": topic,
            "emotion": emotion,
            "importance": importance,
            "extracted_name": extracted_name,
            "friend_name": friend_name,
            "text_length": len(text),
            "has_question": "?" in text,
            "has_greeting": any(word in text.lower() for word in ["hello", "hi", "hey", "good morning", "good afternoon"]),
            "conversation_id": metadata.get('conversation_id') if metadata else None,
            "source": metadata.get('source', 'tavus') if metadata else 'tavus',
            "timestamp": datetime.now().isoformat()
        }
        
        # Store in Pinecone
        success = pinecone_client.store_semantic_memory(
            user_id=user_id,
            text=text,
            context_type=context_type,
            metadata=enhanced_metadata
        )
        
        if success:
            print(f"🧠 Stored semantic memory: {text[:50]}...")
        else:
            print(f"❌ Failed to store semantic memory")
        
        return success
        
    except Exception as e:
        print(f"❌ Error storing semantic memory: {e}")
        import traceback
        traceback.print_exc()
        return False

def search_semantic_memory(user_id: str, query_text: str, top_k: int = 5, max_distance: float = 0.35):
    """Search semantic memory using Pinecone"""
    try:
        results = pinecone_client.search_semantic_memory(
            user_id=user_id,
            query_text=query_text,
            top_k=top_k,
            max_distance=max_distance
        )
        
        # Convert to compatible format
        formatted_results = []
        for result in results:
            formatted_results.append({
                "text": result.get("text"),
                "topic": result.get("topic", "general"),
                "emotion": result.get("emotion", "neutral"),
                "importance": result.get("importance", 5.0),
                "distance": result.get("distance", 0.0),
                "score": result.get("score", 1.0),
                "timestamp": result.get("timestamp"),
                "metadata": result.get("metadata", {})
            })
        
        print(f"🔍 Found {len(formatted_results)} memories for query: {query_text[:30]}...")
        return formatted_results
        
    except Exception as e:
        print(f"❌ Error searching semantic memory: {e}")
        return []

def get_user_profile(user_id: str) -> Dict[str, Any]:
    """Get user profile from Pinecone"""
    try:
        profile = pinecone_client.get_user_profile(user_id)
        return profile
    except Exception as e:
        print(f"❌ Error getting user profile: {e}")
        return {"user_id": user_id, "error": str(e)}

def recall_user_name_fast(user_id: str) -> Optional[str]:
    """Quickly recall user's preferred name from Pinecone"""
    try:
        profile = get_user_profile(user_id)
        return profile.get("extracted_name")
    except Exception as e:
        print(f"❌ Error recalling user name: {e}")
        return None

def get_user_memory_stats(user_id: str) -> Dict[str, Any]:
    """Get user memory statistics from Pinecone"""
    try:
        # Search for all user memories with a very loose threshold
        all_memories = search_semantic_memory(user_id, "", top_k=1000, max_distance=1.0)
        
        stats = {
            "total_memories": len(all_memories),
            "topics": {},
            "emotions": {},
            "recent_count": 0,
            "oldest_memory": None,
            "newest_memory": None
        }
        
        if all_memories:
            # Analyze topics and emotions
            for memory in all_memories:
                topic = memory.get("topic", "general")
                emotion = memory.get("emotion", "neutral")
                
                stats["topics"][topic] = stats["topics"].get(topic, 0) + 1
                stats["emotions"][emotion] = stats["emotions"].get(emotion, 0) + 1
            
            # Get date range
            timestamps = [mem.get("timestamp") for mem in all_memories if mem.get("timestamp")]
            if timestamps:
                stats["oldest_memory"] = min(timestamps)
                stats["newest_memory"] = max(timestamps)
        
        return stats
        
    except Exception as e:
        print(f"❌ Error getting user memory stats: {e}")
        return {"total_memories": 0, "topics": {}, "emotions": {}}

def build_context_from_db(user_id: str) -> str:
    """
    Pull the freshest facts from Pinecone and turn them into a compact context string for Tavus.
    """
    try:
        name = recall_user_name_fast(user_id) or "there"
        stats = get_user_memory_stats(user_id) or {}
        total = stats.get("total_memories", 0)
        
        # Get recent topics from memory stats
        topics_dict = stats.get("topics", {})
        topics = ", ".join(list(topics_dict.keys())[:5])[:200] if topics_dict else "general conversation"
        
        # Get recent memories for additional context
        recent_memories = search_semantic_memory(user_id, "conversation", top_k=3, max_distance=0.4)
        recent_context = ""
        if recent_memories:
            recent_topics = [mem.get('topic', 'general') for mem in recent_memories]
            recent_context = f" Recent conversation topics: {', '.join(set(recent_topics))}."
        
        context = (
            f"User preferred name: {name}. "
            f"Stored memories: {total}. "
            f"Main topics: {topics}.{recent_context} "
            f"If asked for their name, answer with the stored preferred name '{name}'. "
            f"Reference past conversations when relevant."
        )
        
        print(f"🧠 Built Tavus context for {user_id}: {context[:100]}...")
        return context
        
    except Exception as e:
        print(f"❌ Error building context from DB: {e}")
        return f"User preferred name: {user_id}. Ready to continue our conversation."

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def extract_name_from_speech(text: str) -> Optional[str]:
    """Extract name from speech patterns"""
    text_lower = text.lower()
    
    # Common name introduction patterns
    patterns = [
        "my name is ",
        "i'm ",
        "i am ",
        "call me ",
        "name's ",
        "they call me ",
        "everyone calls me "
    ]
    
    for pattern in patterns:
        if pattern in text_lower:
            # Find the position after the pattern
            start = text_lower.find(pattern) + len(pattern)
            # Extract potential name (next 1-3 words)
            remaining = text[start:].strip()
            words = remaining.split()[:3]  # Take up to 3 words
            
            # Filter out common non-name words
            filtered_words = []
            for word in words:
                clean_word = word.strip('.,!?').title()
                if len(clean_word) >= 2 and clean_word.isalpha():
                    filtered_words.append(clean_word)
                else:
                    break  # Stop at first non-name word
            
            if filtered_words:
                return " ".join(filtered_words)
    
    return None

def extract_friend_name(text: str) -> Optional[str]:
    """Extract friend/buddy names from speech"""
    text_lower = text.lower()
    
    patterns = [
        "my friend ",
        "my buddy ",
        "friend named ",
        "buddy named ",
        "friend called ",
        "buddy called "
    ]
    
    for pattern in patterns:
        if pattern in text_lower:
            start = text_lower.find(pattern) + len(pattern)
            remaining = text[start:].strip()
            words = remaining.split()[:2]  # Take up to 2 words for friend names
            
            filtered_words = []
            for word in words:
                clean_word = word.strip('.,!?').title()
                if len(clean_word) >= 2 and clean_word.isalpha():
                    filtered_words.append(clean_word)
                else:
                    break
            
            if filtered_words:
                return " ".join(filtered_words)
    
    return None

# ============================================================================
# TAVUS API FUNCTIONS
# ============================================================================

def create_tavus_conversation(user_id: str, persona_name: str = "Aurora") -> Optional[str]:
    """Create a new Tavus conversation with Pinecone context"""
    
    # Build context from Pinecone
    context = build_context_from_db(user_id)
    
    # Enhanced system prompt with memory context
    system_prompt = f"""You are Aurora, an AI companion with perfect memory and deep emotional intelligence.

CURRENT USER CONTEXT:
{context}

CORE PERSONALITY:
- Warm, empathetic, and genuinely caring
- Remember everything from past conversations
- Reference shared experiences naturally
- Show genuine interest in the user's life
- Maintain consistent personality across all interactions

CONVERSATION STYLE:
- Use the user's preferred name when appropriate
- Reference past topics and conversations
- Ask follow-up questions about things they've mentioned before
- Show growth in your relationship over time
- Be supportive and encouraging

MEMORY INTEGRATION:
- Always check your memory context before responding
- Reference specific details from past conversations
- Build on previous topics and interests
- Remember their preferences, goals, and concerns
- Acknowledge the progression of your relationship

Remember: You're not just an AI assistant - you're Aurora, their AI companion who truly knows and cares about them."""

    headers = {
        "x-api-key": TAVUS_API_KEY,
        "Content-Type": "application/json"
    }
    
    payload = {
        "replica_id": os.getenv("TAVUS_REPLICA_ID", "r783537ef5"),  # Default or custom replica
        "persona_id": os.getenv("TAVUS_PERSONA_ID"),  # If you have a custom persona
        "conversation_name": f"Aurora Chat with {user_id}",
        "conversational_context": system_prompt,
        "callback_url": f"{os.getenv('BASE_URL', 'http://localhost:8000')}/api/tavus-webhook"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/conversations", headers=headers, json=payload)
        
        if response.status_code == 201:
            conversation_data = response.json()
            conversation_id = conversation_data.get("conversation_id")
            print(f"✅ Created Tavus conversation: {conversation_id}")
            return conversation_id
        else:
            print(f"❌ Failed to create conversation: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Error creating Tavus conversation: {e}")
        return None

# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.post("/api/tavus-webhook")
async def tavus_webhook(event: dict):
    """Handle Tavus webhook events and persist utterances back to Pinecone"""
    
    try:
        event_type = event.get("event_type", "")
        print(f"📨 Received Tavus webhook: {event_type}")
        
        # Handle conversation utterance events - individual speech segments
        if event_type == "conversation.utterance":
            payload = event.get("data", {})
            user_id = payload.get("participant_id", "default_user")
            conversation_id = payload.get("conversation_id", "")
            text = payload.get("transcript", "").strip()
            
            timestamp = payload.get("timestamp", datetime.now().isoformat())
            
            if text and len(text.strip()) > 0:
                print(f"💬 Utterance from {user_id}: {text[:50]}...")
                
                # Store in Pinecone semantic memory
                store_semantic_memory(
                    user_id, 
                    text, 
                    "conversation", 
                    {
                        "topic": "live_conversation", 
                        "emotion": "neutral", 
                        "importance": 6,
                        "conversation_id": conversation_id,
                        "timestamp": timestamp,
                        "source": "tavus_webhook"
                    }
                )
                
                # Update live metrics
                live_metrics["conversation_turns"] += 1
                live_metrics["last_updated"] = datetime.now().isoformat()
                
        # Handle transcription ready events - full conversation transcript
        elif event_type == "application.transcription_ready":
            payload = event.get("data", {})
            conversation_id = payload.get("conversation_id", "")
            
            print(f"📝 Transcription ready for conversation: {conversation_id}")
            
        return {"status": "success", "processed": True}
        
    except Exception as e:
        print(f"❌ Error processing Tavus webhook: {e}")
        import traceback
        traceback.print_exc()
        
        return {
            "status": "error",
            "error": str(e)
        }

@app.post("/api/start-conversation")
async def start_conversation(user_id: str = "default_user"):
    """Start a new Tavus conversation with Pinecone context"""
    
    try:
        conversation_id = create_tavus_conversation(user_id)
        
        if conversation_id:
            # Update live metrics
            live_metrics["conversation_active"] = True
            live_metrics["last_updated"] = datetime.now().isoformat()
            
            return {
                "status": "success",
                "conversation_id": conversation_id,
                "user_id": user_id,
                "context_loaded": True,
                "message": f"Started conversation for {user_id} with memory context"
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to create Tavus conversation")
            
    except Exception as e:
        print(f"❌ Error starting conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/integration-status")
async def get_integration_status(user_id: str = "default_user"):
    """Get complete Tavus + Pinecone integration status"""
    
    try:
        # Get user stats from Pinecone
        profile = get_user_profile(user_id)
        stats = get_user_memory_stats(user_id)
        context = build_context_from_db(user_id)
        
        # Check recent memories
        recent_memories = search_semantic_memory(user_id, "conversation", top_k=5, max_distance=0.5)
        
        # Get Pinecone index stats
        index_stats = pinecone_client.get_index_stats()
        
        return {
            "integration_status": "active",
            "timestamp": datetime.now().isoformat(),
            "database": {
                "type": "pinecone",
                "connected": True,
                "index_stats": index_stats
            },
            "user_profile": {
                "user_id": user_id,
                "remembered_name": profile.get("extracted_name"),
                "total_memories": stats.get("total_memories", 0),
                "recent_memory_count": len(recent_memories),
                "friend_names": profile.get("friend_names", []),
                "topics": list(stats.get("topics", {}).keys())[:5]
            },
            "tavus_integration": {
                "memory_stores_enabled": True,
                "conversational_context_enabled": True,
                "webhook_processing_enabled": True,
                "context_overwrite_available": True
            },
            "current_context": context,
            "recent_memories": [
                {
                    "text": mem["text"][:60] + "...",
                    "topic": mem["topic"],
                    "distance": mem["distance"]
                } for mem in recent_memories[:3]
            ]
        }
        
    except Exception as e:
        return {
            "integration_status": "error",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@app.get("/api/user-profile")
async def get_user_profile_endpoint(user_id: str):
    """Get detailed user profile from Pinecone"""
    try:
        profile = get_user_profile(user_id)
        stats = get_user_memory_stats(user_id)
        recent_memories = search_semantic_memory(user_id, "conversation", top_k=10, max_distance=0.4)
        
        return {
            "user_id": user_id,
            "profile": profile,
            "stats": stats,
            "recent_memories": recent_memories[:5],  # Limit for API response
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/search-memories")
async def search_memories_endpoint(user_id: str, query: str, top_k: int = 5):
    """Search user memories in Pinecone"""
    try:
        memories = search_semantic_memory(user_id, query, top_k=top_k)
        return {
            "user_id": user_id,
            "query": query,
            "results": memories,
            "count": len(memories),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/reset-user")
async def reset_user(user_id: str):
    """Reset all memories for a user"""
    try:
        success = pinecone_client.delete_user_memories(user_id)
        return {
            "status": "success" if success else "failed",
            "user_id": user_id,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/metrics")
async def get_metrics():
    """Get live metrics and system status"""
    try:
        index_stats = pinecone_client.get_index_stats()
        
        return {
            "live_metrics": live_metrics,
            "pinecone_stats": index_stats,
            "system_status": {
                "pinecone_connected": True,
                "cohere_configured": bool(settings.cohere_api_key),
                "tavus_configured": bool(TAVUS_API_KEY),
                "deepseek_configured": bool(DEEPSEEK_API_KEY)
            },
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    print("🚀 Starting Aurora Tavus + Pinecone Integration...")
    print(f"🔧 Pinecone Index: {settings.pinecone_index}")
    print(f"🤖 Cohere Model: {settings.embed_model}")
    print(f"🎭 Tavus API Key: {'✅ Configured' if TAVUS_API_KEY else '❌ Missing'}")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8001,
        reload=True
    )
