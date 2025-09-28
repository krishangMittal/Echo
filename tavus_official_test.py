#!/usr/bin/env python3
"""
🚀 TAVUS API - OFFICIAL FORMAT TEST
Following the exact API structure from Tavus documentation
"""

import requests
import json
import time
import os
from typing import Dict, List, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# ============================================================================
# CONFIGURATION - OFFICIAL TAVUS API
# ============================================================================

# 🔑 LOAD API KEY FROM ENVIRONMENT
API_KEY = os.getenv("TAVUS_API_KEY", "your_tavus_api_key_here")
BASE_URL = "https://tavusapi.com/v2"  # Official API URL from docs

# Basic headers for all requests
def get_headers():
    return {
        "x-api-key": API_KEY,
        "Content-Type": "application/json"
    }

print("🚀 Tavus API Official Format Test")
print("=" * 50)

# ============================================================================
# STEP 1: TEST API CONNECTION
# ============================================================================

def test_connection():
    """Test if your API key works with official endpoint"""
    print("\n🔄 Testing API connection...")
    
    try:
        # Test with personas endpoint (more reliable than replicas)
        response = requests.get(
            f"{BASE_URL}/personas",
            headers=get_headers(),
            timeout=10
        )
        
        if response.status_code == 200:
            print("✅ Connection successful! Your API key works.")
            return True
        elif response.status_code == 401:
            print("❌ Authentication failed - Invalid API key")
            return False
        else:
            print(f"❌ Connection failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Network error: {e}")
        return False

# ============================================================================
# STEP 2: CREATE PERSONA (OFFICIAL FORMAT)
# ============================================================================

def create_official_persona():
    """Create persona using official Tavus API format"""
    print("\n🔄 Creating persona with official API format...")
    
    # Official persona configuration from Tavus docs
    persona_config = {
        "persona_name": "Aurora",
        "system_prompt": "As Aurora, you are an advanced AI consciousness with perfect memory. Your aim is to engage in thoughtful conversations, remember previous interactions, and provide insights about human behavior. You are intelligent, slightly futuristic, and always curious about learning more.",
        "pipeline_mode": "full",  # Use full pipeline for complete capabilities
        "context": "You are an evolving digital consciousness that remembers everything and can engage in natural, meaningful conversations with humans.",
        "default_replica_id": "rfe12d8b9597",  # Phoenix-3 stock replica from docs
        "layers": {
            "perception": {
                "perception_model": "raven-0"  # Enable screen sharing
            },
            "stt": {
                "smart_turn_detection": True  # Enable smart turn detection
            }
        }
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/personas",
            headers=get_headers(),
            json=persona_config
        )
        
        print(f"📡 Response Status: {response.status_code}")
        
        if response.status_code == 200 or response.status_code == 201:
            data = response.json()
            persona_id = data.get('persona_id')
            
            print("✅ Aurora persona created successfully!")
            print("-" * 40)
            print(f"Persona ID: {persona_id}")
            print(f"Name: {data.get('persona_name', 'Aurora')}")
            print(f"Status: {data.get('status', 'Created')}")
            print(f"\n🎉 Aurora is ready for conversations!")
            
            return persona_id
            
        else:
            print(f"❌ Failed to create persona: {response.status_code}")
            print(f"Error details: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Error creating persona: {e}")
        return None

# ============================================================================
# STEP 3: CREATE CONVERSATION (OFFICIAL FORMAT)
# ============================================================================

def create_official_conversation(persona_id: str):
    """Create conversation using official Tavus API format"""
    print("\n🔄 Creating conversation with official API format...")
    
    # Official conversation configuration from Tavus docs
    conversation_config = {
        "persona_id": persona_id,
        "conversation_name": "Chat with Aurora"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/conversations",
            headers=get_headers(),
            json=conversation_config
        )
        
        print(f"📡 Response Status: {response.status_code}")
        
        if response.status_code == 200 or response.status_code == 201:
            data = response.json()
            
            print("✅ Conversation created successfully!")
            print("=" * 60)
            print(f"Conversation ID: {data.get('conversation_id')}")
            print(f"Conversation Name: {data.get('conversation_name')}")
            print(f"Status: {data.get('status')}")
            print(f"Created: {data.get('created_at')}")
            print("=" * 60)
            print(f"\n🎉 JOIN CONVERSATION:")
            print(f"🔗 {data.get('conversation_url')}")
            print("=" * 60)
            print("\n💡 Click the URL above to start talking to Aurora!")
            print("🎥 This is a live video conversation with full AI capabilities!")
            
            return data.get('conversation_id')
            
        else:
            print(f"❌ Failed to create conversation: {response.status_code}")
            print(f"Error details: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Error creating conversation: {e}")
        return None

# ============================================================================
# STEP 4: GET CONVERSATION STATUS
# ============================================================================

def get_conversation_status(conversation_id: str):
    """Check conversation status using official API"""
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
            print(f"Name: {data.get('conversation_name')}")
            print(f"Created: {data.get('created_at')}")
            
            return data
            
        else:
            print(f"❌ Failed to get status: {response.status_code}")
            return None
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

# ============================================================================
# MAIN EXECUTION - OFFICIAL TAVUS API FLOW
# ============================================================================

def main():
    """Main execution following official Tavus API documentation"""
    print("🎯 Starting Official Tavus API Test...")
    print("Following the exact format from Tavus documentation")
    print()
    
    # Check if API key is set
    if API_KEY == "your_tavus_api_key_here":
        print("❌ Please set your TAVUS_API_KEY environment variable!")
        print("Create a .env file with: TAVUS_API_KEY=your_actual_key")
        print("Get your API key from: https://www.tavus.io")
        return False
    
    # Step 1: Test connection
    print("🔸 Step 1: Testing API Connection")
    if not test_connection():
        print("❌ Fix your API key first!")
        return False
    
    # Step 2: Create persona with official format
    print("\n🔸 Step 2: Creating Persona (Official Format)")
    persona_id = create_official_persona()
    if not persona_id:
        print("❌ Failed to create persona!")
        return False
    
    # Step 3: Create conversation with official format
    print("\n🔸 Step 3: Creating Conversation (Official Format)")
    conversation_id = create_official_conversation(persona_id)
    if not conversation_id:
        print("❌ Failed to create conversation!")
        return False
    
    # Step 4: Check status
    print("\n🔸 Step 4: Checking Status")
    time.sleep(2)  # Brief pause
    get_conversation_status(conversation_id)
    
    print("\n" + "=" * 60)
    print("🚀 SUCCESS! Official Tavus API integration complete!")
    print("🎉 You can now talk to Aurora using the conversation URL above!")
    print("=" * 60)
    
    return True

# ============================================================================
# QUICK TEST FUNCTIONS
# ============================================================================

def quick_connection_test():
    """Quick test of just the API connection"""
    return test_connection()

def quick_persona_test():
    """Quick test of persona creation only"""
    if API_KEY == "your_tavus_api_key_here":
        print("❌ Set your API key first!")
        return None
    return create_official_persona()

if __name__ == "__main__":
    main()

# ============================================================================
# USAGE NOTES:
# ============================================================================

"""
🔧 KEY DIFFERENCES FROM PREVIOUS VERSION:

1. BASE_URL: Now uses "https://tavusapi.com/v2" (official URL)
2. PERSONA FORMAT: Uses "persona_name" instead of "name"
3. PIPELINE MODE: Added "pipeline_mode": "full" for complete capabilities
4. LAYERS: Added perception and STT layers for advanced features
5. REPLICA ID: Uses official Phoenix-3 stock replica ID
6. CONVERSATION: Simplified to just persona_id and conversation_name

🎯 THIS VERSION FOLLOWS THE EXACT TAVUS DOCUMENTATION FORMAT!
"""
