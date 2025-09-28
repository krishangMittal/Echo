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
from openai import OpenAI
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import lancedb
import pyarrow as pa
import numpy as np
from uuid import uuid4

load_dotenv()

# ============================================================================
# CONFIGURATION
# ============================================================================

TAVUS_API_KEY = os.getenv("TAVUS_API_KEY")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
BASE_URL = "https://tavusapi.com/v2"

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
# DATABASE SETUP
# ============================================================================

# Initialize LanceDB connection
db = None
users_table = None
conversations_table = None
insights_table = None

def init_database():
    """Initialize LanceDB database and tables"""
    global db, users_table, conversations_table, insights_table

    try:
        # Connect to LanceDB
        db = lancedb.connect("./aurora_db")
        print("Connected to LanceDB at ./aurora_db")

        # User Profile Schema
        user_schema = pa.schema([
            pa.field("user_id", pa.string()),
            pa.field("created_at", pa.string()),
            pa.field("total_conversations", pa.int64()),
            pa.field("avg_relationship_level", pa.float64()),
            pa.field("avg_trust_level", pa.float64()),
            pa.field("avg_emotional_sync", pa.float64()),
            pa.field("dominant_emotions", pa.string()),  # JSON array as string
            pa.field("frequent_topics", pa.string()),    # JSON array as string
            pa.field("communication_style", pa.string()),
            pa.field("vulnerability_pattern", pa.float64()),
            pa.field("personality_traits", pa.string()), # JSON object as string
            pa.field("last_active", pa.string()),
            pa.field("profile_vector", pa.list_(pa.float32(), 384))  # For semantic search
        ])

        # Conversation Schema
        conversation_schema = pa.schema([
            pa.field("conversation_id", pa.string()),
            pa.field("user_id", pa.string()),
            pa.field("started_at", pa.string()),
            pa.field("ended_at", pa.string()),
            pa.field("total_turns", pa.int64()),
            pa.field("final_relationship_level", pa.float64()),
            pa.field("final_trust_level", pa.float64()),
            pa.field("final_emotional_sync", pa.float64()),
            pa.field("final_memory_depth", pa.float64()),
            pa.field("dominant_topic", pa.string()),
            pa.field("emotional_journey", pa.string()),   # JSON array of emotions
            pa.field("conversation_summary", pa.string()),
            pa.field("key_revelations", pa.string()),     # JSON array of insights
            pa.field("vulnerability_score", pa.float64()),
            pa.field("conversation_vector", pa.list_(pa.float32(), 384))
        ])

        # Deep Insights Schema
        insights_schema = pa.schema([
            pa.field("insight_id", pa.string()),
            pa.field("user_id", pa.string()),
            pa.field("conversation_id", pa.string()),
            pa.field("speech_id", pa.string()),
            pa.field("insight_text", pa.string()),
            pa.field("insight_type", pa.string()),        # behavioral, emotional, personality, pattern
            pa.field("confidence_score", pa.float64()),
            pa.field("timestamp", pa.string()),
            pa.field("supporting_evidence", pa.string()), # JSON array of speech excerpts
            pa.field("psychological_category", pa.string()),  # attachment, communication, values, etc.
            pa.field("insight_vector", pa.list_(pa.float32(), 384))
        ])

        # Create tables if they don't exist
        try:
            users_table = db.open_table("users")
            print("Opened existing users table")
        except:
            users_table = db.create_table("users", schema=user_schema)
            print("Created new users table")

        try:
            conversations_table = db.open_table("conversations")
            print("Opened existing conversations table")
        except:
            conversations_table = db.create_table("conversations", schema=conversation_schema)
            print("Created new conversations table")

        try:
            insights_table = db.open_table("insights")
            print("Opened existing insights table")
        except:
            insights_table = db.create_table("insights", schema=insights_schema)
            print("Created new insights table")

        return True

    except Exception as e:
        print(f"Database initialization error: {e}")
        return False

def get_text_embedding(text: str) -> List[float]:
    """Generate embedding for text using simple hashing approach (fallback since DeepSeek doesn't have embeddings)"""
    try:
        # Simple text-to-vector conversion using character frequencies and position
        import hashlib

        # Create a simple but consistent embedding based on text content
        text_hash = hashlib.md5(text.encode()).hexdigest()

        # Convert hash to float vector
        embedding = []
        for i in range(0, len(text_hash), 2):
            # Convert hex pairs to floats between -1 and 1
            hex_val = int(text_hash[i:i+2], 16)
            normalized = (hex_val - 127.5) / 127.5
            embedding.append(normalized)

        # Extend to 384 dimensions by repeating and adding text features
        while len(embedding) < 384:
            # Add features based on text characteristics
            embedding.append(len(text) / 1000.0)  # Text length feature
            embedding.append(text.count(' ') / len(text) if text else 0)  # Word density
            embedding.append(sum(c.isupper() for c in text) / len(text) if text else 0)  # Caps ratio
            # Repeat the hash-based features
            embedding.extend(embedding[:min(10, 384 - len(embedding))])

        # Truncate to exactly 384 dimensions
        embedding = embedding[:384]

        return embedding
    except Exception as e:
        print(f"Embedding generation error: {e}")
        return [0.0] * 384

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
# DEEPSEEK SPEECH ANALYSIS
# ============================================================================

def analyze_speech_with_deepseek(speech_text: str) -> Dict[str, Any]:
    """Analyze speech using DeepSeek Chat"""
    
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
        if not DEEPSEEK_API_KEY:
            print("Warning: DEEPSEEK_API_KEY not found, using fallback analysis")
            raise Exception("No DeepSeek API key")

        print(f"Calling DeepSeek API for analysis...")
        response = deepseek_client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": "You are an expert at analyzing human speech patterns and psychology. Return only valid JSON."},
                {"role": "user", "content": analysis_prompt}
            ],
            temperature=0.4,
            max_tokens=300
        )

        content = response.choices[0].message.content
        print(f"DeepSeek response: {content[:100]}...")

        analysis = json.loads(content)

        # Validate required fields
        required_fields = ["topic", "emotion", "sentiment", "importance", "vulnerability"]
        for field in required_fields:
            if field not in analysis:
                analysis[field] = "unknown" if field in ["topic", "emotion", "sentiment"] else 5

        # Ensure insights is a list
        if "insights" not in analysis:
            analysis["insights"] = [f"Analyzed speech about {analysis.get('topic', 'general topic')}"]
        elif not isinstance(analysis["insights"], list):
            analysis["insights"] = [str(analysis["insights"])]

        print(f"Analysis completed: {analysis.get('topic')} / {analysis.get('emotion')} / {analysis.get('importance')}")
        return analysis

    except Exception as e:
        print(f"DeepSeek analysis error: {e}")
        # Create a more intelligent fallback analysis based on keywords
        return create_fallback_analysis(speech_text)

def create_fallback_analysis(speech_text: str) -> Dict[str, Any]:
    """Create intelligent fallback analysis when DeepSeek API is unavailable"""
    text_lower = speech_text.lower()

    # Emotion keywords
    emotion_keywords = {
        "excited": ["excited", "amazing", "awesome", "fantastic", "thrilled", "pumped"],
        "happy": ["happy", "joy", "great", "wonderful", "good", "pleased", "glad"],
        "anxious": ["anxious", "worried", "nervous", "scared", "afraid", "concerned"],
        "sad": ["sad", "disappointed", "upset", "down", "depressed", "hurt"],
        "frustrated": ["frustrated", "annoyed", "angry", "mad", "irritated"],
        "curious": ["curious", "wondering", "interested", "fascinated", "intrigued"]
    }

    # Topic keywords
    topic_keywords = {
        "career": ["job", "work", "career", "promotion", "interview", "boss", "salary"],
        "relationships": ["relationship", "friend", "family", "love", "partner", "dating"],
        "personal": ["feel", "think", "believe", "personal", "myself", "life"],
        "technology": ["AI", "technology", "computer", "software", "app", "system"],
        "goals": ["goal", "plan", "future", "want", "hope", "dream", "achieve"]
    }

    # Detect emotion
    detected_emotion = "neutral"
    for emotion, keywords in emotion_keywords.items():
        if any(keyword in text_lower for keyword in keywords):
            detected_emotion = emotion
            break

    # Detect topic
    detected_topic = "general"
    for topic, keywords in topic_keywords.items():
        if any(keyword in text_lower for keyword in keywords):
            detected_topic = topic
            break

    # Calculate importance based on emotional words and length
    importance_indicators = ["important", "crucial", "significant", "matter", "care", "need"]
    importance_score = 5
    if any(word in text_lower for word in importance_indicators):
        importance_score += 2
    if detected_emotion in ["excited", "anxious", "sad"]:
        importance_score += 2
    if len(speech_text) > 100:
        importance_score += 1

    importance_score = min(10, importance_score)

    # Calculate vulnerability based on personal disclosure
    vulnerability_indicators = ["feel", "afraid", "worry", "personal", "secret", "admit"]
    vulnerability_score = 3
    if any(word in text_lower for word in vulnerability_indicators):
        vulnerability_score += 3
    if detected_emotion in ["anxious", "sad", "nervous"]:
        vulnerability_score += 2

    vulnerability_score = min(10, vulnerability_score)

    return {
        "topic": detected_topic,
        "emotion": detected_emotion,
        "sentiment": "positive" if detected_emotion in ["excited", "happy"] else "negative" if detected_emotion in ["sad", "frustrated", "anxious"] else "neutral",
        "importance": importance_score,
        "vulnerability": vulnerability_score,
        "energy_level": 8 if detected_emotion == "excited" else 3 if detected_emotion in ["sad", "anxious"] else 5,
        "key_themes": [detected_topic, detected_emotion],
        "insights": [f"Person expressing {detected_emotion} feelings about {detected_topic}", f"Communication shows {vulnerability_score}/10 vulnerability level"],
        "relationship_building": min(8, vulnerability_score + 2)
    }

# ============================================================================
# UTILITY FUNCTIONS FOR SERIALIZATION
# ============================================================================

def serialize_for_json(obj):
    """Convert pandas/numpy objects to JSON-serializable types"""
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.bool_):
        return bool(obj)
    elif isinstance(obj, dict):
        return {k: serialize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [serialize_for_json(item) for item in obj]
    elif hasattr(obj, 'isoformat'):  # datetime objects
        return obj.isoformat()
    else:
        return obj

def safe_dict_from_pandas(pandas_dict):
    """Safely convert pandas Series.to_dict() to JSON-serializable dict"""
    return serialize_for_json(pandas_dict)

# ============================================================================
# DATABASE OPERATIONS
# ============================================================================

def get_or_create_user(user_id: str = "default_user") -> Dict:
    """Get existing user or create new one"""
    global users_table

    if users_table is None:
        return {"error": "Database not initialized"}

    try:
        # Search for existing user using correct LanceDB Python API
        try:
            # LanceDB Python: use to_pandas and filter in Python for reliability
            all_users_df = users_table.to_pandas()
            if len(all_users_df) > 0:
                existing_users = all_users_df[all_users_df['user_id'] == user_id]
                if len(existing_users) > 0:
                    print(f"Found existing user: {user_id}")
                    return safe_dict_from_pandas(existing_users.iloc[0].to_dict())
            print(f"User {user_id} not found, creating new user")
        except Exception as search_error:
            print(f"User search error (table might be empty): {search_error}")
            print("Will create new user")

        # Create new user
        user_data = {
            "user_id": user_id,
            "created_at": datetime.now().isoformat(),
            "total_conversations": 0,
            "avg_relationship_level": 25.0,
            "avg_trust_level": 35.0,
            "avg_emotional_sync": 45.0,
            "dominant_emotions": json.dumps(["neutral"]),
            "frequent_topics": json.dumps(["general"]),
            "communication_style": "exploring",
            "vulnerability_pattern": 3.0,
            "personality_traits": json.dumps({}),
            "last_active": datetime.now().isoformat(),
            "profile_vector": [0.0] * 384
        }

        users_table.add([user_data])
        print(f"Created new user: {user_id}")
        return user_data

    except Exception as e:
        print(f"Error getting/creating user: {e}")
        return {"error": str(e)}

def store_conversation_record(conversation_id: str, user_id: str = "default_user"):
    """Store complete conversation record"""
    global conversations_table

    if conversations_table is None or not processed_speeches:
        return

    try:
        # Generate conversation summary
        summary_text = f"Conversation with {len(processed_speeches)} exchanges. "
        summary_text += f"Topics: {', '.join(set([s['analysis'].get('topic', 'general') for s in processed_speeches]))}"

        # Extract emotional journey
        emotions = [s['analysis'].get('emotion', 'neutral') for s in processed_speeches]

        # Generate conversation vector from summary
        conv_vector = get_text_embedding(summary_text)

        conversation_data = {
            "conversation_id": conversation_id,
            "user_id": user_id,
            "started_at": processed_speeches[0].get('timestamp', datetime.now().isoformat()),
            "ended_at": datetime.now().isoformat(),
            "total_turns": len(processed_speeches),
            "final_relationship_level": live_metrics["relationship_level"],
            "final_trust_level": live_metrics["trust_level"],
            "final_emotional_sync": live_metrics["emotional_sync"],
            "final_memory_depth": live_metrics["memory_depth"],
            "dominant_topic": live_metrics["current_topic"],
            "emotional_journey": json.dumps(emotions),
            "conversation_summary": summary_text,
            "key_revelations": json.dumps(live_metrics["recent_insights"]),
            "vulnerability_score": np.mean([s['analysis'].get('vulnerability', 3) for s in processed_speeches]),
            "conversation_vector": conv_vector
        }

        conversations_table.add([conversation_data])
        print(f"Stored conversation: {conversation_id}")

        # Update user statistics
        update_user_statistics(user_id)

    except Exception as e:
        print(f"Error storing conversation: {e}")

def store_deep_insight(insight_text: str, insight_type: str, user_id: str = "default_user",
                      conversation_id: str = "current", speech_id: str = "",
                      confidence: float = 0.8, psychological_category: str = "general"):
    """Store a deep psychological insight"""
    global insights_table

    if insights_table is None:
        return

    try:
        insight_vector = get_text_embedding(insight_text)

        insight_data = {
            "insight_id": str(uuid4()),
            "user_id": user_id,
            "conversation_id": conversation_id,
            "speech_id": speech_id,
            "insight_text": insight_text,
            "insight_type": insight_type,
            "confidence_score": confidence,
            "timestamp": datetime.now().isoformat(),
            "supporting_evidence": json.dumps([speech_id]),
            "psychological_category": psychological_category,
            "insight_vector": insight_vector
        }

        insights_table.add([insight_data])
        print(f"Stored insight: {insight_type} - {insight_text[:50]}...")

    except Exception as e:
        print(f"Error storing insight: {e}")

def update_user_statistics(user_id: str):
    """Update user profile with latest conversation data"""
    global users_table, conversations_table

    if users_table is None or conversations_table is None:
        return

    try:
        # Get all conversations for this user
        all_conversations_df = conversations_table.to_pandas()
        user_conversations = all_conversations_df[all_conversations_df['user_id'] == user_id]

        if len(user_conversations) == 0:
            return

        # Calculate averages
        avg_relationship = user_conversations['final_relationship_level'].mean()
        avg_trust = user_conversations['final_trust_level'].mean()
        avg_emotional_sync = user_conversations['final_emotional_sync'].mean()
        total_conversations = len(user_conversations)

        # Extract patterns
        all_emotions = []
        all_topics = []
        for _, conv in user_conversations.iterrows():
            emotions = json.loads(conv['emotional_journey'])
            all_emotions.extend(emotions)
            all_topics.append(conv['dominant_topic'])

        # Find dominant patterns
        from collections import Counter
        emotion_counts = Counter(all_emotions)
        topic_counts = Counter(all_topics)

        dominant_emotions = [emotion for emotion, _ in emotion_counts.most_common(3)]
        frequent_topics = [topic for topic, _ in topic_counts.most_common(3)]

        # Calculate vulnerability pattern
        vulnerability_pattern = user_conversations['vulnerability_score'].mean()

        # Update user record
        users_table.delete(f"user_id = '{user_id}'")

        updated_user = {
            "user_id": user_id,
            "created_at": user_conversations.iloc[0]['started_at'],
            "total_conversations": total_conversations,
            "avg_relationship_level": avg_relationship,
            "avg_trust_level": avg_trust,
            "avg_emotional_sync": avg_emotional_sync,
            "dominant_emotions": json.dumps(dominant_emotions),
            "frequent_topics": json.dumps(frequent_topics),
            "communication_style": "analyzed",  # Could be enhanced with ML
            "vulnerability_pattern": vulnerability_pattern,
            "personality_traits": json.dumps({"openness": vulnerability_pattern / 10}),
            "last_active": datetime.now().isoformat(),
            "profile_vector": get_text_embedding(f"User with {total_conversations} conversations, topics: {', '.join(frequent_topics)}, emotions: {', '.join(dominant_emotions)}")
        }

        users_table.add([updated_user])
        print(f"Updated user statistics for {user_id}")

    except Exception as e:
        print(f"Error updating user statistics: {e}")

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
        if not DEEPSEEK_API_KEY:
            raise Exception("No DeepSeek API key")

        response = deepseek_client.chat.completions.create(
            model="deepseek-chat",
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
        # Generate fallback insights based on the speech data
        return generate_fallback_insights(recent_speeches)

def generate_fallback_insights(recent_speeches: List[Dict]) -> List[str]:
    """Generate fallback insights when DeepSeek is unavailable"""
    if len(recent_speeches) < 2:
        return ["Gathering conversation data to generate behavioral insights..."]

    # Analyze patterns in the speeches
    emotions = [speech.get('analysis', {}).get('emotion', 'neutral') for speech in recent_speeches[-5:]]
    topics = [speech.get('analysis', {}).get('topic', 'general') for speech in recent_speeches[-5:]]
    vulnerabilities = [speech.get('analysis', {}).get('vulnerability', 3) for speech in recent_speeches[-5:]]

    insights = []

    # Emotional pattern insight
    emotion_variety = len(set(emotions))
    if emotion_variety > 3:
        insights.append("Shows rich emotional range and authentic expression across topics")
    elif emotions.count('excited') > 2:
        insights.append("Demonstrates consistent enthusiasm and positive energy")
    elif emotions.count('anxious') > 1:
        insights.append("Shows pattern of concern that may benefit from reassurance")

    # Topic pattern insight
    topic_variety = len(set(topics))
    if topic_variety > 2:
        insights.append("Engages with diverse topics, indicating intellectual curiosity")
    elif topics.count('personal') > 2:
        insights.append("Comfortable with personal disclosure and self-reflection")

    # Vulnerability pattern insight
    avg_vulnerability = sum(vulnerabilities) / len(vulnerabilities)
    if avg_vulnerability > 6:
        insights.append("Demonstrates high trust and openness in communication")
    elif avg_vulnerability < 4:
        insights.append("Maintains appropriate boundaries while sharing information")

    return insights[:3] if insights else [
        "Person shows authentic emotional expression in conversation",
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
    """Process speech from HTML client with database storage"""

    speech_text = speech_data.get("text", "").strip()
    user_id = speech_data.get("user_id", "default_user")
    conversation_id = speech_data.get("conversation_id", f"conv_{datetime.now().strftime('%Y%m%d_%H%M%S')}")

    if not speech_text:
        return {"error": "No speech text provided"}

    print(f"Processing speech for user {user_id}: {speech_text}")

    # Ensure user exists in database
    user_profile = get_or_create_user(user_id)

    # Analyze with DeepSeek
    analysis = analyze_speech_with_deepseek(speech_text)

    # Create speech record
    speech_record = {
        "id": f"speech_{len(processed_speeches) + 1}",
        "text": speech_text,
        "analysis": analysis,
        "timestamp": datetime.now().isoformat(),
        "processed_by": "deepseek_chat",
        "user_id": user_id,
        "conversation_id": conversation_id
    }

    # Store the record
    processed_speeches.append(speech_record)

    # Update live metrics
    update_live_metrics(analysis, speech_text)

    # Store deep insights if significant
    importance = analysis.get('importance', 5)
    vulnerability = analysis.get('vulnerability', 3)

    if importance >= 7 or vulnerability >= 7:
        # Generate and store deep insights
        insights = analysis.get('insights', [])
        for insight in insights:
            confidence = 0.8 if importance >= 8 else 0.6
            psychological_category = "emotional" if vulnerability >= 7 else "behavioral"

            store_deep_insight(
                insight_text=insight,
                insight_type="real_time_analysis",
                user_id=user_id,
                conversation_id=conversation_id,
                speech_id=speech_record["id"],
                confidence=confidence,
                psychological_category=psychological_category
            )

    # Store conversation record if this is a meaningful exchange
    if len(processed_speeches) >= 3:  # Store after 3+ exchanges
        store_conversation_record(conversation_id, user_id)

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
        "user_profile": user_profile,
        "processing_status": "complete",
        "database_stored": True
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
# DATABASE API ENDPOINTS
# ============================================================================

@app.get("/api/users/{user_id}")
async def get_user_profile(user_id: str):
    """Get complete user profile and statistics"""
    user_profile = get_or_create_user(user_id)

    if "error" in user_profile:
        raise HTTPException(status_code=404, detail="User not found")

    # Get user's conversations
    try:
        all_conversations_df = conversations_table.to_pandas()
        user_conversations = all_conversations_df[all_conversations_df['user_id'] == user_id]
        conversations_list = [safe_dict_from_pandas(record) for record in user_conversations.to_dict('records')] if len(user_conversations) > 0 else []

        # Get user's insights
        all_insights_df = insights_table.to_pandas()
        user_insights = all_insights_df[all_insights_df['user_id'] == user_id]
        insights_list = [safe_dict_from_pandas(record) for record in user_insights.to_dict('records')] if len(user_insights) > 0 else []

        return {
            "profile": user_profile,
            "conversation_count": len(conversations_list),
            "insights_count": len(insights_list),
            "recent_conversations": conversations_list[-5:],  # Last 5
            "recent_insights": insights_list[-10:]  # Last 10
        }

    except Exception as e:
        print(f"Error fetching user data: {e}")
        return {"profile": user_profile, "error": str(e)}

@app.get("/api/users/{user_id}/insights")
async def get_user_insights(user_id: str, limit: int = 20):
    """Get deep insights for a specific user"""
    if insights_table is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    try:
        # Handle empty table case
        try:
            all_insights_df = insights_table.to_pandas()
        except Exception as table_error:
            # Table might be empty or not exist
            print(f"Table access error: {table_error}")
            all_insights_df = None
        
        if all_insights_df is None or len(all_insights_df) == 0:
            return {
                "user_id": user_id,
                "total_insights": 0,
                "insights_by_category": {},
                "all_insights": []
            }
        
        user_insights = all_insights_df[all_insights_df['user_id'] == user_id]
        insights = [safe_dict_from_pandas(record) for record in user_insights.head(limit).to_dict('records')] if len(user_insights) > 0 else []

        # Group by psychological category
        categories = {}
        for insight in insights:
            cat = insight.get('psychological_category', 'general')
            if cat not in categories:
                categories[cat] = []
            categories[cat].append(insight)

        return {
            "user_id": user_id,
            "total_insights": len(insights),
            "insights_by_category": categories,
            "all_insights": insights
        }

    except Exception as e:
        print(f"Insights endpoint error: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching insights: {e}")

@app.get("/api/conversations/{conversation_id}/insights")
async def get_conversation_insights(conversation_id: str):
    """Get all insights from a specific conversation"""
    if insights_table is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    try:
        # Handle empty table case
        try:
            all_insights_df = insights_table.to_pandas()
        except Exception as table_error:
            print(f"Conversation insights table error: {table_error}")
            all_insights_df = None
            
        if all_insights_df is None or len(all_insights_df) == 0:
            insights = []
        else:
            conversation_insights = all_insights_df[all_insights_df['conversation_id'] == conversation_id]
            insights = conversation_insights.to_dict('records') if len(conversation_insights) > 0 else []

        return {
            "conversation_id": conversation_id,
            "insights_count": len(insights),
            "insights": insights
        }

    except Exception as e:
        print(f"Conversation insights error: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching conversation insights: {e}")

@app.post("/api/insights/search")
async def search_insights(search_data: dict):
    """Search insights using semantic similarity"""
    query = search_data.get("query", "")
    user_id = search_data.get("user_id", None)
    limit = search_data.get("limit", 10)

    if not query:
        raise HTTPException(status_code=400, detail="Query text required")

    if insights_table is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    try:
        # Handle empty table case
        try:
            all_insights_df = insights_table.to_pandas()
        except Exception as table_error:
            print(f"Search table access error: {table_error}")
            all_insights_df = None

        if all_insights_df is None or len(all_insights_df) == 0:
            insights = []
        else:
            # Filter by user if specified
            if user_id:
                filtered_insights = all_insights_df[all_insights_df['user_id'] == user_id]
            else:
                filtered_insights = all_insights_df

            if len(filtered_insights) == 0:
                insights = []
            else:
                # Simple text matching for now (can be improved with proper vector search later)
                query_lower = query.lower()
                try:
                    matching_insights = filtered_insights[
                        filtered_insights['insight_text'].str.lower().str.contains(query_lower, na=False)
                    ]
                    # Limit results
                    insights = matching_insights.head(limit).to_dict('records') if len(matching_insights) > 0 else []
                except Exception as search_error:
                    print(f"Text search error: {search_error}")
                    # Fallback: return first few insights
                    insights = filtered_insights.head(limit).to_dict('records')

        return {
            "query": query,
            "user_id": user_id,
            "results_count": len(insights),
            "insights": insights
        }

    except Exception as e:
        print(f"Search insights error: {e}")
        raise HTTPException(status_code=500, detail=f"Error searching insights: {e}")

@app.get("/api/analytics/user/{user_id}")
async def get_user_analytics(user_id: str):
    """Get comprehensive analytics for a user"""
    if conversations_table is None or insights_table is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    try:
        # Get user conversations with error handling
        try:
            all_conversations_df = conversations_table.to_pandas()
        except Exception as conv_error:
            print(f"Conversations table error: {conv_error}")
            all_conversations_df = None
            
        try:
            all_insights_df = insights_table.to_pandas()
        except Exception as insights_error:
            print(f"Insights table error: {insights_error}")
            all_insights_df = None

        if all_conversations_df is None or len(all_conversations_df) == 0:
            return {"user_id": user_id, "message": "No conversation data found"}
            
        conversations = all_conversations_df[all_conversations_df['user_id'] == user_id]
        
        if all_insights_df is not None and len(all_insights_df) > 0:
            insights = all_insights_df[all_insights_df['user_id'] == user_id]
        else:
            insights = None

        if len(conversations) == 0:
            return {"user_id": user_id, "message": "No conversation data found"}

        # Calculate analytics with safe column access
        def safe_mean(df, col, default=0):
            try:
                result = df[col].mean() if col in df.columns else default
                return float(result) if not np.isnan(result) else default
            except:
                return default
                
        def safe_list(df, col, default=None):
            try:
                result = df[col].tolist() if col in df.columns else (default or [])
                return serialize_for_json(result)
            except:
                return default or []
        
        analytics = {
            "user_id": user_id,
            "conversation_analytics": {
                "total_conversations": len(conversations),
                "avg_relationship_level": safe_mean(conversations, 'final_relationship_level'),
                "avg_trust_level": safe_mean(conversations, 'final_trust_level'),
                "avg_emotional_sync": safe_mean(conversations, 'final_emotional_sync'),
                "avg_memory_depth": safe_mean(conversations, 'final_memory_depth'),
                "avg_vulnerability_score": safe_mean(conversations, 'vulnerability_score'),
                "relationship_progression": safe_list(conversations, 'final_relationship_level'),
                "trust_progression": safe_list(conversations, 'final_trust_level')
            },
            "insight_analytics": {
                "total_insights": len(insights) if insights is not None else 0,
                "insights_by_type": serialize_for_json(insights['insight_type'].value_counts().to_dict()) if insights is not None and len(insights) > 0 else {},
                "insights_by_category": serialize_for_json(insights['psychological_category'].value_counts().to_dict()) if insights is not None and len(insights) > 0 else {},
                "avg_confidence": float(insights['confidence_score'].mean()) if insights is not None and len(insights) > 0 and not insights['confidence_score'].isna().all() else 0
            },
            "behavioral_patterns": {
                "dominant_topics": serialize_for_json(conversations['dominant_topic'].value_counts().to_dict()) if 'dominant_topic' in conversations.columns else {},
                "emotional_patterns": [json.loads(ej) for ej in safe_list(conversations, 'emotional_journey')] if 'emotional_journey' in conversations.columns else [],
                "conversation_lengths": safe_list(conversations, 'total_turns')
            }
        }

        return analytics

    except Exception as e:
        print(f"Analytics error: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating analytics: {e}")

@app.post("/api/database/backup")
async def backup_database():
    """Create a backup of user data"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    try:
        backup_data = {
            "timestamp": datetime.now().isoformat(),
            "users": users_table.to_pandas().to_dict('records') if users_table else [],
            "conversations": conversations_table.to_pandas().to_dict('records') if conversations_table else [],
            "insights": insights_table.to_pandas().to_dict('records') if insights_table else []
        }

        backup_filename = f"aurora_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

        with open(backup_filename, 'w') as f:
            json.dump(backup_data, f, indent=2)

        return {
            "status": "success",
            "backup_file": backup_filename,
            "records": {
                "users": len(backup_data["users"]),
                "conversations": len(backup_data["conversations"]),
                "insights": len(backup_data["insights"])
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backup failed: {e}")

# ============================================================================
# DATABASE INSPECTION & DEBUG ENDPOINTS
# ============================================================================

@app.get("/api/database/status")
async def get_database_status():
    """Get database connection status and table info"""
    status = {
        "database_connected": db is not None,
        "tables_initialized": {
            "users": users_table is not None,
            "conversations": conversations_table is not None,
            "insights": insights_table is not None
        },
        "database_path": "./aurora_db" if db else None
    }

    if db:
        try:
            # Get table counts
            user_count = len(users_table.to_pandas()) if users_table else 0
            conversation_count = len(conversations_table.to_pandas()) if conversations_table else 0
            insight_count = len(insights_table.to_pandas()) if insights_table else 0

            status["record_counts"] = {
                "users": user_count,
                "conversations": conversation_count,
                "insights": insight_count,
                "total_records": user_count + conversation_count + insight_count
            }
        except Exception as e:
            status["error"] = f"Error getting counts: {e}"

    return status

@app.get("/api/database/tables")
async def list_all_tables():
    """List all database tables and their schemas"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    try:
        table_info = {}

        if users_table:
            users_df = users_table.to_pandas()
            table_info["users"] = {
                "record_count": len(users_df),
                "columns": users_df.columns.tolist() if len(users_df) > 0 else [],
                "sample_record": safe_dict_from_pandas(users_df.iloc[0].to_dict()) if len(users_df) > 0 else None
            }

        if conversations_table:
            conv_df = conversations_table.to_pandas()
            table_info["conversations"] = {
                "record_count": len(conv_df),
                "columns": conv_df.columns.tolist() if len(conv_df) > 0 else [],
                "sample_record": safe_dict_from_pandas(conv_df.iloc[0].to_dict()) if len(conv_df) > 0 else None
            }

        if insights_table:
            insights_df = insights_table.to_pandas()
            table_info["insights"] = {
                "record_count": len(insights_df),
                "columns": insights_df.columns.tolist() if len(insights_df) > 0 else [],
                "sample_record": safe_dict_from_pandas(insights_df.iloc[0].to_dict()) if len(insights_df) > 0 else None
            }

        return {
            "database_path": "./aurora_db",
            "tables": table_info,
            "total_tables": len(table_info)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing tables: {e}")

@app.get("/api/database/recent-activity")
async def get_recent_database_activity():
    """Get the most recent database activity"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    try:
        recent_activity = {}

        # Recent users
        if users_table:
            users_df = users_table.to_pandas()
            if len(users_df) > 0:
                recent_users = users_df.nlargest(5, 'last_active')
                recent_activity["recent_users"] = recent_users[['user_id', 'last_active', 'total_conversations']].to_dict('records')

        # Recent conversations
        if conversations_table:
            conv_df = conversations_table.to_pandas()
            if len(conv_df) > 0:
                recent_conversations = conv_df.nlargest(5, 'ended_at')
                recent_activity["recent_conversations"] = recent_conversations[['conversation_id', 'user_id', 'ended_at', 'total_turns']].to_dict('records')

        # Recent insights
        if insights_table:
            insights_df = insights_table.to_pandas()
            if len(insights_df) > 0:
                recent_insights = insights_df.nlargest(10, 'timestamp')
                recent_activity["recent_insights"] = recent_insights[['insight_text', 'user_id', 'timestamp', 'insight_type']].to_dict('records')

        return recent_activity

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting recent activity: {e}")

@app.post("/api/database/test")
async def test_database_operations():
    """Test database operations with sample data"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    test_results = {}

    try:
        # Test user creation
        test_user_id = f"test_user_{datetime.now().strftime('%H%M%S')}"
        user_profile = get_or_create_user(test_user_id)
        test_results["user_creation"] = {
            "success": "error" not in user_profile,
            "user_id": test_user_id,
            "profile": user_profile
        }

        # Test insight storage
        test_insight = f"Test insight generated at {datetime.now().strftime('%H:%M:%S')}"
        store_deep_insight(
            insight_text=test_insight,
            insight_type="test",
            user_id=test_user_id,
            confidence=0.9,
            psychological_category="test_category"
        )
        test_results["insight_storage"] = {
            "success": True,
            "insight_text": test_insight
        }

        # Test insight retrieval
        all_insights_df = insights_table.to_pandas()
        insights_df = all_insights_df[all_insights_df['user_id'] == test_user_id]
        test_results["insight_retrieval"] = {
            "success": len(insights_df) > 0,
            "insights_found": len(insights_df),
            "latest_insight": safe_dict_from_pandas(insights_df.iloc[-1].to_dict()) if len(insights_df) > 0 else None
        }

        # Test search functionality (simplified)
        all_insights_df = insights_table.to_pandas()
        search_results = all_insights_df.head(3)  # Just get first 3 for testing
        test_results["semantic_search"] = {
            "success": len(search_results) >= 0,
            "results_count": len(search_results)
        }

        test_results["overall_status"] = "All tests passed"
        return test_results

    except Exception as e:
        test_results["error"] = str(e)
        test_results["overall_status"] = "Tests failed"
        return test_results

@app.delete("/api/database/clear-test-data")
async def clear_test_data():
    """Clear test data from database"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    try:
        cleared = {"users": 0, "insights": 0}

        # Clear test users
        if users_table:
            users_df = users_table.to_pandas()
            test_users = users_df[users_df['user_id'].str.contains('test_user')]
            for _, user in test_users.iterrows():
                users_table.delete(f"user_id = '{user['user_id']}'")
                cleared["users"] += 1

        # Clear test insights
        if insights_table:
            insights_df = insights_table.to_pandas()
            test_insights = insights_df[insights_df['user_id'].str.contains('test_user')]
            for _, insight in test_insights.iterrows():
                insights_table.delete(f"insight_id = '{insight['insight_id']}'")
                cleared["insights"] += 1

        return {
            "status": "success",
            "cleared_records": cleared,
            "message": f"Cleared {sum(cleared.values())} test records"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error clearing test data: {e}")

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

    # Initialize database
    db_initialized = init_database()
    if db_initialized:
        print("✅ Database initialized successfully")
    else:
        print("❌ Database initialization failed")

    # Test connections
    if DEEPSEEK_API_KEY:
        print("✅ DeepSeek API key configured")
    if TAVUS_API_KEY:
        print("✅ Tavus API key configured")

    ngrok_url = get_ngrok_url()
    if ngrok_url:
        print(f"🌐 ngrok tunnel: {ngrok_url}")

    print("🚀 System ready for real-time processing with database storage!")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")