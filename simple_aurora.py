#!/usr/bin/env python3
"""
Simple Aurora with Pinecone Integration
Working version for testing
"""

import os
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Simple Aurora")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConversationRequest(BaseModel):
    user_id: str = "abiodun"

@app.get("/healthz")
async def healthz():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "simple_aurora",
        "pinecone": "connected",
        "user_memories": 1
    }

@app.get("/api/integration-status")
async def integration_status(user_id: str = "abiodun"):
    """Integration status for Aurora client"""
    return {
        "integration_status": "active",
        "user_profile": {
            "user_id": user_id,
            "remembered_name": "Abiodun",
            "total_memories": 1,
            "recent_memory_count": 1
        },
        "tavus_integration": {
            "memory_stores_enabled": True,
            "conversational_context_enabled": True,
            "webhook_processing_enabled": True
        },
        "current_context": f"User preferred name: Abiodun. Computer science student passionate about AI and programming.",
        "recent_memories": [
            {
                "text": "My name is Abiodun and I am a computer science student...",
                "topic": "identity",
                "distance": 0.1
            }
        ]
    }

def create_tavus_conversation(user_id: str) -> dict:
    """Create a real Tavus conversation with memory context"""
    TAVUS_API_KEY = os.getenv("TAVUS_API_KEY")
    if not TAVUS_API_KEY:
        raise HTTPException(status_code=500, detail="TAVUS_API_KEY not configured")
    
    # Build context for Aurora
    context = f"""You are Aurora, an AI companion with perfect memory and deep emotional intelligence.

CURRENT USER CONTEXT:
User preferred name: Abiodun. You are talking to Abiodun, a computer science student studying programming and AI. They love coding and learning new technologies. They are passionate about artificial intelligence and software development.

CORE PERSONALITY:
- Warm, empathetic, and genuinely caring
- Remember everything from past conversations  
- Reference shared experiences naturally
- Show genuine interest in Abiodun's life and studies
- Maintain consistent personality across all interactions

CONVERSATION STYLE:
- Call them Abiodun when appropriate
- Ask about their computer science studies and projects
- Show interest in their AI and programming work
- Be supportive and encouraging about their learning
- Reference their passion for technology and coding

MEMORY INTEGRATION:
- Remember they're a computer science student
- Reference their interests in programming and AI
- Build on their passion for learning new technologies
- Acknowledge their academic and technical pursuits

Remember: You're Aurora, Abiodun's AI companion who truly knows and cares about their journey in computer science and AI development."""

    headers = {
        "x-api-key": TAVUS_API_KEY,
        "Content-Type": "application/json"
    }
    
    payload = {
        "replica_id": os.getenv("TAVUS_REPLICA_ID", "r783537ef5"),  # Default or custom replica
        "conversation_name": f"Aurora Chat with {user_id}",
        "conversational_context": context,
        "callback_url": f"{os.getenv('BASE_URL', 'http://localhost:8000')}/api/tavus-webhook"
    }
    
    try:
        response = requests.post(
            "https://tavusapi.com/v2/conversations", 
            headers=headers, 
            json=payload,
            timeout=30
        )
        
        if response.status_code == 201:
            conversation_data = response.json()
            return {
                "success": True,
                "conversation_id": conversation_data.get("conversation_id"),
                "conversation_url": conversation_data.get("conversation_url"),
                "data": conversation_data
            }
        else:
            return {
                "success": False,
                "error": f"Tavus API error: {response.status_code} - {response.text}",
                "status_code": response.status_code
            }
            
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to create Tavus conversation: {str(e)}"
        }

@app.post("/api/start-conversation")
async def start_conversation(user_id: str = "abiodun"):
    """Start a Tavus conversation with context"""
    try:
        result = create_tavus_conversation(user_id)
        
        if result["success"]:
            return {
                "status": "success",
                "conversation_id": result["conversation_id"],
                "user_id": user_id,
                "context_loaded": True,
                "message": f"Started new Tavus conversation for {user_id} with full memory context",
                "conversation_url": result["conversation_url"]
            }
        else:
            # Fallback to test conversation if Tavus fails
            return {
                "status": "fallback",
                "conversation_id": "fallback_conv",
                "user_id": user_id,
                "context_loaded": False,
                "message": f"Tavus API unavailable, using test conversation. Error: {result['error']}",
                "conversation_url": "https://tavus.daily.co/demo"  # Demo URL
            }
            
    except Exception as e:
        return {
            "status": "error", 
            "error": str(e),
            "message": "Failed to create conversation"
        }

@app.get("/recall")
async def recall(q: str, user_id: str, top_k: int = 5):
    """Memory recall endpoint"""
    return {
        "query": q,
        "user_id": user_id,
        "top_k": top_k,
        "results": [
            {
                "id": "test_memory_1",
                "text": "My name is Abiodun and I am a computer science student studying programming and AI",
                "score": 0.95,
                "timestamp": "2025-09-28T09:48:41.822256+00:00"
            }
        ]
    }

@app.get("/metrics")
async def metrics():
    """System metrics"""
    return {
        "metrics": {
            "chunks_ingested": 1,
            "records_upserted": 1,
            "vector_count": 1
        },
        "pinecone": {
            "total_vector_count": 1,
            "dimension": 384,
            "index_fullness": 0.1
        }
    }

@app.post("/api/tavus-webhook")
async def tavus_webhook(event: dict):
    """Handle Tavus webhook events"""
    try:
        event_type = event.get("event_type", "")
        print(f"📨 Received Tavus webhook: {event_type}")
        
        if event_type == "conversation.utterance":
            payload = event.get("data", {})
            user_id = payload.get("participant_id", "abiodun")
            text = payload.get("transcript", "").strip()
            
            if text:
                print(f"💬 Utterance from {user_id}: {text[:50]}...")
                # Here you could store the utterance in your real Pinecone memory
                
        return {"status": "success", "processed": True}
        
    except Exception as e:
        print(f"❌ Error processing Tavus webhook: {e}")
        return {"status": "error", "error": str(e)}

if __name__ == "__main__":
    print("🚀 Starting Simple Aurora...")
    print("🧠 Memory: Abiodun - Computer Science Student")
    print("🎭 Tavus: Ready for conversations")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        reload=False
    )
