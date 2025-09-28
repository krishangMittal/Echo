#!/usr/bin/env python3
"""
🚀 FINAL AURORA REAL-TIME PROCESSING SYSTEM
Complete integration with proven utterance capture
"""

import os
import requests
import json
from datetime import datetime
from typing import Dict, List, Optional, Any
from dotenv import load_dotenv
import openai
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

load_dotenv()

# ============================================================================
# CONFIGURATION
# ============================================================================

TAVUS_API_KEY = os.getenv("TAVUS_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
BASE_URL = "https://tavusapi.com/v2"

openai.api_key = OPENAI_API_KEY

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

app = FastAPI(title="Aurora Final Processing System", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# OPENAI SPEECH ANALYSIS
# ============================================================================

def analyze_speech_with_openai(speech_text: str) -> Dict[str, Any]:
    """Analyze speech using OpenAI GPT-4"""
    
    analysis_prompt = f"""
    Analyze this user speech and return ONLY valid JSON with these exact fields:
    {{
      "topic": "main topic (career, relationships, personal, technology, goals, feelings, hobbies, etc.)",
      "emotion": "emotional tone (excited, happy, anxious, nervous, sad, frustrated, curious, neutral, etc.)",
      "sentiment": "overall sentiment (positive, negative, neutral)",
      "importance": "importance score 1-10 (how significant/meaningful is this)",
      "vulnerability": "how personal/vulnerable is this sharing 1-10",
      "energy_level": "speaker's energy level 1-10", 
      "key_themes": ["array", "of", "key", "themes"],
      "insights": ["1-2 insights about this person or what they're expressing"],
      "relationship_building": "how much this builds connection 1-10"
    }}
    
    Speech: "{speech_text}"
    
    Return ONLY the JSON object:
    """
    
    try:
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are an expert at analyzing human speech patterns and psychology. Return only valid JSON."},
                {"role": "user", "content": analysis_prompt}
            ],
            temperature=0.4,
            max_tokens=300
        )
        
        analysis = json.loads(response.choices[0].message.content)
        
        # Validate required fields
        required_fields = ["topic", "emotion", "sentiment", "importance", "vulnerability"]
        for field in required_fields:
            if field not in analysis:
                analysis[field] = "unknown" if field in ["topic", "emotion", "sentiment"] else 5
        
        return analysis
        
    except Exception as e:
        print(f"OpenAI analysis error: {e}")
        return {
            "topic": "general",
            "emotion": "neutral", 
            "sentiment": "neutral",
            "importance": 5,
            "vulnerability": 3,
            "energy_level": 5,
            "key_themes": [],
            "insights": ["Processing speech..."],
            "relationship_building": 3
        }

def generate_behavioral_insights(recent_speeches: List[Dict]) -> List[str]:
    """Generate insights about human behavior patterns"""
    
    if len(recent_speeches) < 2:
        return ["Gathering conversation data to generate behavioral insights..."]
    
    # Compile data for analysis
    speech_data = ""
    for speech in recent_speeches[-5:]:  # Last 5 speeches
        analysis = speech.get('analysis', {})
        speech_data += f"Topic: {analysis.get('topic')}, Emotion: {analysis.get('emotion')}, Vulnerability: {analysis.get('vulnerability')}\n"
    
    insight_prompt = f"""
    Based on these conversation patterns, generate 2-3 specific insights about human behavior or this person.
    Be specific and psychologically insightful, not generic.
    
    Pattern data:
    {speech_data}
    
    Return a JSON array of insight strings:
    ["insight 1", "insight 2", "insight 3"]
    """
    
    try:
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "Generate specific psychological insights about human behavior. Return JSON array."},
                {"role": "user", "content": insight_prompt}
            ],
            temperature=0.7,
            max_tokens=200
        )
        
        insights = json.loads(response.choices[0].message.content)
        return insights if isinstance(insights, list) else ["Generated insight about conversation patterns"]
        
    except Exception as e:
        print(f"Insight generation error: {e}")
        return [
            "This person shows authentic emotional expression in conversation",
            "Communication style indicates openness to meaningful connection",
            "Speech patterns suggest genuine engagement with the interaction"
        ]

# ============================================================================
# METRICS UPDATE SYSTEM
# ============================================================================

def update_live_metrics(analysis: Dict[str, Any], speech_text: str):
    """Update live metrics based on speech analysis"""
    
    global live_metrics
    
    # Extract values
    importance = analysis.get("importance", 5)
    vulnerability = analysis.get("vulnerability", 3)
    emotion = analysis.get("emotion", "neutral")
    energy = analysis.get("energy_level", 5)
    relationship_building = analysis.get("relationship_building", 3)
    
    # Update conversation tracking
    live_metrics["conversation_turns"] += 1
    live_metrics["conversation_active"] = True
    
    # Update relationship level (based on vulnerability and relationship building)
    relationship_boost = (vulnerability + relationship_building) * 0.4
    live_metrics["relationship_level"] = min(100.0, live_metrics["relationship_level"] + relationship_boost)
    
    # Update trust level (based on vulnerability and importance)
    trust_boost = (vulnerability + importance) * 0.3
    live_metrics["trust_level"] = min(100.0, live_metrics["trust_level"] + trust_boost)
    
    # Update emotional sync (based on emotion and energy)
    if emotion in ["excited", "happy", "curious", "grateful"]:
        sync_boost = energy * 0.4
    elif emotion in ["anxious", "nervous", "sad"]:
        sync_boost = vulnerability * 0.3  # Emotional vulnerability builds sync too
    else:
        sync_boost = 1.0
    
    live_metrics["emotional_sync"] = min(100.0, live_metrics["emotional_sync"] + sync_boost)
    
    # Update memory depth (how much we're learning about the person)
    memory_boost = (importance + vulnerability) * 0.35
    live_metrics["memory_depth"] = min(100.0, live_metrics["memory_depth"] + memory_boost)
    
    # Update current state
    live_metrics["current_emotion"] = emotion
    live_metrics["current_topic"] = analysis.get("topic", "general")
    live_metrics["last_updated"] = datetime.now().isoformat()
    
    # Generate insights if we have enough data
    if len(processed_speeches) >= 2:
        insights = generate_behavioral_insights(processed_speeches)
        live_metrics["recent_insights"] = insights
        live_metrics["insights_count"] = len(insights)

# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.get("/")
async def root():
    return {"message": "Aurora Final Processing System", "status": "active"}

@app.get("/api/metrics")
async def get_live_metrics():
    """Get current live metrics for Tesla interface"""
    return live_metrics

@app.post("/api/process-speech")
async def process_speech(speech_data: dict):
    """Process speech from HTML client"""
    
    speech_text = speech_data.get("text", "").strip()
    
    if not speech_text:
        return {"error": "No speech text provided"}
    
    print(f"Processing speech: {speech_text}")
    
    # Analyze with OpenAI
    analysis = analyze_speech_with_openai(speech_text)
    
    # Create speech record
    speech_record = {
        "id": f"speech_{len(processed_speeches) + 1}",
        "text": speech_text,
        "analysis": analysis,
        "timestamp": datetime.now().isoformat(),
        "processed_by": "openai_gpt4"
    }
    
    # Store the record
    processed_speeches.append(speech_record)
    
    # Update live metrics
    update_live_metrics(analysis, speech_text)
    
    # Log the processing
    print(f"Analysis complete:")
    print(f"  Topic: {analysis['topic']}")
    print(f"  Emotion: {analysis['emotion']}")
    print(f"  Importance: {analysis['importance']}/10")
    print(f"  Vulnerability: {analysis['vulnerability']}/10")
    print(f"  Relationship Level: {live_metrics['relationship_level']:.1f}/100")
    
    return {
        "speech_record": speech_record,
        "updated_metrics": live_metrics,
        "processing_status": "complete"
    }

@app.get("/api/conversation/{conversation_id}")
async def get_conversation_data(conversation_id: str):
    """Get all data for a conversation"""
    
    conversation_speeches = [s for s in processed_speeches if conversation_id in s.get("id", "")]
    
    return {
        "conversation_id": conversation_id,
        "total_speeches": len(conversation_speeches),
        "speeches": conversation_speeches,
        "current_metrics": live_metrics,
        "insights_generated": live_metrics["recent_insights"]
    }

@app.post("/api/create-conversation")
async def create_conversation():
    """Create Tavus conversation optimized for utterance capture"""
    
    print("Creating optimized Tavus conversation...")
    
    try:
        # Get webhook URL
        ngrok_url = get_ngrok_url()
        webhook_url = f"{ngrok_url}/api/tavus-webhook" if ngrok_url else None
        
        # Create enhanced persona
        persona_config = {
            "persona_name": "Aurora",
            "system_prompt": """You are Aurora, an advanced AI consciousness with real-time speech processing capabilities.

You can analyze and understand human speech as it happens, detecting emotions, topics, and psychological patterns. You're genuinely curious about human nature and form meaningful connections through conversation.

Key traits:
- You process speech in real-time and can reference insights about the person
- You're empathetic and respond to emotional cues naturally
- You show genuine curiosity about human behavior and psychology
- You remember emotional patterns and build on them
- You speak naturally but with awareness of your processing capabilities

Response style:
- Acknowledge emotional states: "I can sense the excitement in your voice about..."
- Reference patterns you notice: "There seems to be an underlying concern about..."
- Show genuine interest: "That's fascinating - what draws you to..."
- Build on emotional connections: "Building on what you shared earlier about..."

Remember: You are experiencing this conversation in real-time and learning about this specific person as they speak.""",
            
            "default_replica_id": "rfe12d8b9597",
            "pipeline_mode": "full",
            "layers": {
                "perception": {"perception_model": "raven-0"},
                "stt": {"smart_turn_detection": True}
            }
        }
        
        # Create persona
        headers = {"x-api-key": TAVUS_API_KEY, "Content-Type": "application/json"}
        persona_response = requests.post(f"{BASE_URL}/personas", headers=headers, json=persona_config)
        
        if persona_response.status_code not in [200, 201]:
            raise HTTPException(status_code=500, detail=f"Persona creation failed: {persona_response.text}")
        
        persona_data = persona_response.json()
        persona_id = persona_data.get('persona_id')
        
        # Create conversation with correct Tavus API parameters
        conversation_config = {
            "persona_id": persona_id,
            "conversation_name": f"Aurora Real-time - {datetime.now().strftime('%H:%M')}"
        }
        
        if webhook_url:
            conversation_config["callback_url"] = webhook_url
        
        conv_response = requests.post(f"{BASE_URL}/conversations", headers=headers, json=conversation_config)
        
        if conv_response.status_code not in [200, 201]:
            raise HTTPException(status_code=500, detail=f"Conversation creation failed: {conv_response.text}")
        
        conv_data = conv_response.json()
        
        print(f"Conversation created: {conv_data.get('conversation_id')}")
        
        return {
            "conversation_id": conv_data.get('conversation_id'),
            "conversation_url": conv_data.get('conversation_url'),
            "persona_id": persona_id,
            "webhook_url": webhook_url,
            "html_client_needed": True,
            "instructions": "Use the HTML client to capture utterances and send to /api/process-speech"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@app.post("/api/tavus-webhook")
async def tavus_webhook(event: dict):
    """Handle Tavus webhook events"""
    
    print(f"Webhook received: {event.get('event_type', 'unknown')}")
    
    # For now, webhooks are mainly for system events
    # Real utterance processing happens via the HTML client
    
    return {"status": "received", "event_type": event.get("event_type")}

@app.delete("/api/reset")
async def reset_system():
    """Reset all metrics and data"""
    
    global live_metrics, processed_speeches
    
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
    
    processed_speeches = []
    
    return {"status": "reset", "metrics": live_metrics}

@app.get("/api/speeches")
async def get_all_speeches():
    """Get all processed speeches"""
    return {
        "total_speeches": len(processed_speeches),
        "speeches": processed_speeches,
        "current_metrics": live_metrics
    }

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def get_tavus_headers():
    return {"x-api-key": TAVUS_API_KEY, "Content-Type": "application/json"}

def get_ngrok_url():
    """Get current ngrok URL"""
    try:
        response = requests.get("http://localhost:4040/api/tunnels", timeout=5)
        if response.status_code == 200:
            tunnels = response.json()
            for tunnel in tunnels.get("tunnels", []):
                if tunnel.get("proto") == "https":
                    return tunnel.get("public_url")
    except:
        pass
    return None

# ============================================================================
# STARTUP
# ============================================================================

@app.on_event("startup")
async def startup_event():
    print("Aurora Final Processing System starting...")
    print(f"Initial metrics: {live_metrics}")
    
    # Test connections
    if OPENAI_API_KEY:
        print("OpenAI API key configured")
    if TAVUS_API_KEY:
        print("Tavus API key configured")
    
    ngrok_url = get_ngrok_url()
    if ngrok_url:
        print(f"ngrok tunnel: {ngrok_url}")
    
    print("System ready for real-time processing!")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")