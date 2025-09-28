#!/usr/bin/env python3
"""
🔑 TAVUS API KEY TEST
Simple script to test if your Tavus API key is working
"""

import requests
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_tavus_key():
    """Test Tavus API key with a simple request"""
    
    # Get API key from environment
    api_key = os.getenv("TAVUS_API_KEY")
    
    if not api_key:
        print("❌ TAVUS_API_KEY not found in environment variables")
        print("💡 Create a .env file with: TAVUS_API_KEY=your_key_here")
        return False
    
    if api_key == "your_tavus_api_key_here":
        print("❌ Please set your actual Tavus API key in .env file")
        return False
    
    print(f"🔑 Testing Tavus API key: {api_key[:8]}...")
    print("=" * 50)
    
    # Test endpoint - get replicas (avatars)
    url = "https://api.tavus.io/v2/replicas"
    headers = {
        "x-api-key": api_key,
        "Content-Type": "application/json"
    }
    
    try:
        print("🔄 Making test request to Tavus API...")
        response = requests.get(url, headers=headers, timeout=10)
        
        print(f"📡 Response Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            replicas = data.get('data', [])
            
            print("✅ SUCCESS! Your Tavus API key is working!")
            print(f"🎭 Found {len(replicas)} available avatars")
            
            # Show first few avatars
            if replicas:
                print("\n🎯 Available Avatars:")
                for i, replica in enumerate(replicas[:3]):  # Show first 3
                    name = replica.get('name', 'Unnamed')
                    status = replica.get('status', 'Unknown')
                    print(f"  {i+1}. {name} - {status}")
            
            return True
            
        elif response.status_code == 401:
            print("❌ AUTHENTICATION FAILED!")
            print("🔧 Your API key is invalid or expired")
            print("💡 Get a new key from: https://www.tavus.io")
            return False
            
        elif response.status_code == 403:
            print("❌ FORBIDDEN!")
            print("🔧 Your API key doesn't have permission for this endpoint")
            return False
            
        else:
            print(f"❌ UNEXPECTED ERROR: {response.status_code}")
            print(f"📝 Response: {response.text}")
            return False
            
    except requests.exceptions.Timeout:
        print("❌ REQUEST TIMEOUT!")
        print("🌐 Check your internet connection")
        return False
        
    except requests.exceptions.ConnectionError:
        print("❌ CONNECTION ERROR!")
        print("🌐 Cannot reach Tavus API - check your internet")
        return False
        
    except Exception as e:
        print(f"❌ UNEXPECTED ERROR: {e}")
        return False

def main():
    """Main test function"""
    print("🚀 TAVUS API KEY TEST")
    print("=" * 50)
    
    success = test_tavus_key()
    
    print("\n" + "=" * 50)
    if success:
        print("🎉 TEST PASSED! Your Tavus setup is ready!")
        print("💡 You can now run tavus_official_test.py for the full tutorial")
    else:
        print("💥 TEST FAILED! Fix the issues above and try again")
        print("🔧 Make sure your .env file has: TAVUS_API_KEY=your_actual_key")

if __name__ == "__main__":
    main()