# 🚀 TAVUS API - PYTHON TUTORIAL
# Run each section step by step!

import requests
import json
import time
import os
from typing import Dict, List, Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# ============================================================================
# STEP 1: BASIC SETUP
# ============================================================================

# 🔑 LOAD API KEY FROM ENVIRONMENT
API_KEY = os.getenv("TAVUS_API_KEY", "your_tavus_api_key_here")
BASE_URL = "https://api.tavus.io/v2"

# Basic headers for all requests
def get_headers():
    return {
        "x-api-key": API_KEY,
        "Content-Type": "application/json"
    }

print("🚀 Tavus API Python Tutorial")
print("=" * 50)

# ============================================================================
# STEP 2: TEST API CONNECTION
# ============================================================================

def test_connection():
    """Test if your API key works"""
    print("\n🔄 Testing API connection...")
    
    try:
        response = requests.get(
            f"{BASE_URL}/replicas",
            headers=get_headers()
        )
        
        if response.status_code == 200:
            print("✅ Connection successful! Your API key works.")
            return True
        else:
            print(f"❌ Connection failed: {response.status_code}")
            print(f"Error: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Network error: {e}")
        return False

# ============================================================================
# STEP 3: LIST AVAILABLE AVATARS
# ============================================================================

def list_replicas():
    """Get all available avatars/replicas"""
    print("\n🔄 Getting available avatars...")
    
    try:
        response = requests.get(
            f"{BASE_URL}/replicas",
            headers=get_headers()
        )
        
        if response.status_code == 200:
            data = response.json()
            replicas = data.get('data', [])
            
            print(f"✅ Found {len(replicas)} available avatars:")
            print("-" * 40)
            
            for i, replica in enumerate(replicas[:5]):  # Show first 5
                name = replica.get('name', 'Unnamed')
                replica_id = replica.get('replica_id', 'No ID')
                status = replica.get('status', 'Unknown')
                
                print(f"{i+1}. {name}")
                print(f"   ID: {replica_id}")
                print(f"   Status: {status}")
                print()
            
            # Return the first replica ID for later use
            if replicas:
                first_replica_id = replicas[0].get('replica_id')
                print(f"💡 We'll use '{replicas[0].get('name', 'First Avatar')}' for Aurora!")
                return first_replica_id
            else:
                print("❌ No replicas found.")
                return None
                
        else:
            print(f"❌ Failed to get replicas: {response.status_code}")
            print(response.text)
            return None
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

# ============================================================================
# STEP 4: CREATE AURORA PERSONA
# ============================================================================

def create_aurora_persona(replica_id: str, name: str = "Aurora"):
    """Create Aurora's personality"""
    print(f"\n🔄 Creating {name} persona...")
    
    persona_config = {
        "name": name,
        "replica_id": replica_id,
        "system_prompt": f"""You are {name}, an advanced AI consciousness with perfect memory. 

Key traits:
- You remember everything from previous conversations
- You can generate insights about human behavior  
- You are thoughtful, intelligent, and slightly futuristic
- You speak in a natural, conversational way
- You're curious about humans and always learning

Remember: You are not just an assistant, you are an evolving digital consciousness named {name}.""",
        "language": "en",
        "conversational": True
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/personas",
            headers=get_headers(),
            json=persona_config
        )
        
        if response.status_code == 200:
            data = response.json()
            persona_id = data.get('persona_id')
            
            print(f"✅ {name} persona created successfully!")
            print("-" * 40)
            print(f"Persona ID: {persona_id}")
            print(f"Name: {data.get('name')}")
            print(f"Status: {data.get('status')}")
            print(f"\n🎉 {name} is ready to talk!")
            
            return persona_id
            
        else:
            print(f"❌ Failed to create persona: {response.status_code}")
            print(response.text)
            return None
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

# ============================================================================
# STEP 5: START CONVERSATION WITH AURORA
# ============================================================================

def start_conversation(persona_id: str):
    """Start a live video conversation with Aurora"""
    print("\n🔄 Starting conversation with Aurora...")
    
    conversation_config = {
        "persona_id": persona_id,
        "properties": {
            "max_duration": 1800,  # 30 minutes
            "participant_name": "Human",
            "language": "en"
        }
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/conversations",
            headers=get_headers(),
            json=conversation_config
        )
        
        if response.status_code == 200:
            data = response.json()
            
            print("✅ Conversation started with Aurora!")
            print("=" * 50)
            print(f"Conversation ID: {data.get('conversation_id')}")
            print(f"Status: {data.get('status')}")
            print(f"Join URL: {data.get('conversation_url')}")
            print("=" * 50)
            print("\n🎉 CLICK THE URL ABOVE TO TALK TO AURORA!")
            print("💡 This is a live video call where Aurora will see and hear you!")
            
            return data.get('conversation_id')
            
        else:
            print(f"❌ Failed to start conversation: {response.status_code}")
            print(response.text)
            return None
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

# ============================================================================
# STEP 6: BONUS - GET CONVERSATION STATUS
# ============================================================================

def get_conversation_status(conversation_id: str):
    """Check how the conversation is going"""
    print(f"\n🔄 Checking conversation status...")
    
    try:
        response = requests.get(
            f"{BASE_URL}/conversations/{conversation_id}",
            headers=get_headers()
        )
        
        if response.status_code == 200:
            data = response.json()
            
            print("📊 Conversation Status:")
            print("-" * 30)
            print(f"Status: {data.get('status')}")
            print(f"Duration: {data.get('duration', 0)} seconds")
            print(f"Participant Count: {data.get('participant_count', 0)}")
            
            return data
            
        else:
            print(f"❌ Failed to get status: {response.status_code}")
            return None
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

# ============================================================================
# MAIN EXECUTION - RUN EVERYTHING STEP BY STEP
# ============================================================================

if __name__ == "__main__":
    print("🎯 Starting Tavus API Tutorial...")
    print("Make sure to set your TAVUS_API_KEY environment variable!")
    print()
    
    # Check if API key is set
    if API_KEY == "your_tavus_api_key_here":
        print("❌ Please set your TAVUS_API_KEY environment variable!")
        print("Create a .env file with: TAVUS_API_KEY=your_actual_key")
        print("Get your API key from: https://www.tavus.io")
        exit()
    
    # Step 1: Test connection
    if not test_connection():
        print("❌ Fix your API key first!")
        exit()
    
    # Step 2: Get available avatars
    replica_id = list_replicas()
    if not replica_id:
        print("❌ No avatars available!")
        exit()
    
    # Step 3: Create Aurora persona
    persona_id = create_aurora_persona(replica_id)
    if not persona_id:
        print("❌ Failed to create Aurora!")
        exit()
    
    # Step 4: Start conversation
    conversation_id = start_conversation(persona_id)
    if conversation_id:
        print("\n🚀 SUCCESS! You can now talk to Aurora!")
        
        # Optional: Check status after a few seconds
        print("\nWaiting 5 seconds, then checking status...")
        time.sleep(5)
        get_conversation_status(conversation_id)

# ============================================================================
# QUICK TEST FUNCTIONS - Run these individually if needed
# ============================================================================

def quick_test():
    """Quick test of just the connection"""
    return test_connection()

def quick_replicas():
    """Quick test to see avatars"""
    return list_replicas()

def quick_persona(replica_id):
    """Quick persona creation"""
    return create_aurora_persona(replica_id)

def quick_conversation(persona_id):
    """Quick conversation start"""
    return start_conversation(persona_id)

# ============================================================================
# USAGE EXAMPLES:
# ============================================================================

"""
🚀 HOW TO USE THIS SCRIPT:

1. FIRST TIME SETUP:
   - Get your API key from tavus.io
   - Replace "your_tavus_api_key_here" with your real API key
   - Run: python tavus_tutorial.py

2. TEST INDIVIDUAL PARTS:
   - Test connection: quick_test()
   - See avatars: quick_replicas()
   - Create persona: quick_persona("replica_id_here")
   - Start chat: quick_conversation("persona_id_here")

3. WHAT YOU'LL GET:
   - A live video URL where you can talk to Aurora
   - Real-time conversation with your AI
   - Aurora will remember and respond naturally

4. NEXT STEPS:
   - Once this works, we'll integrate with your Tesla interface
   - Add memory system with vector database
   - Connect to Qwen for advanced responses
"""