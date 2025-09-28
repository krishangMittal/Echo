#!/usr/bin/env python3
"""
🔧 Environment Configuration Checker
Check if your .env file is properly configured for Aurora
"""

import os
from dotenv import load_dotenv

def check_environment():
    """Check environment configuration"""
    print("🔧 Aurora Environment Configuration Check")
    print("=" * 50)

    # Load environment variables
    load_dotenv()

    # Check for .env file
    env_file_exists = os.path.exists('.env')
    print(f"📄 .env file exists: {'✅' if env_file_exists else '❌'}")

    if not env_file_exists:
        print("\n❌ No .env file found!")
        print("Create a .env file with the following content:")
        print("""
# Add your API keys here
DEEPSEEK_API_KEY=your_deepseek_api_key_here
TAVUS_API_KEY=your_tavus_api_key_here
        """)
        return False

    # Check API keys
    deepseek_key = os.getenv("DEEPSEEK_API_KEY")
    tavus_key = os.getenv("TAVUS_API_KEY")

    print(f"\n🔑 API Key Configuration:")
    print(f"   DEEPSEEK_API_KEY: {'✅ Found' if deepseek_key else '❌ Missing'}")
    print(f"   TAVUS_API_KEY: {'✅ Found' if tavus_key else '❌ Missing (optional for database testing)'}")

    if deepseek_key:
        print(f"   DeepSeek key length: {len(deepseek_key)} characters")
        print(f"   DeepSeek key preview: {deepseek_key[:8]}...{deepseek_key[-4:]}")

    # Check required dependencies
    print(f"\n📦 Checking Dependencies:")
    required_packages = [
        'fastapi', 'uvicorn', 'lancedb', 'pyarrow', 'numpy',
        'openai', 'requests', 'python-dotenv'
    ]

    missing_packages = []
    for package in required_packages:
        try:
            __import__(package)
            print(f"   {package}: ✅")
        except ImportError:
            print(f"   {package}: ❌")
            missing_packages.append(package)

    if missing_packages:
        print(f"\n❌ Missing packages: {', '.join(missing_packages)}")
        print("Install them with: pip install " + " ".join(missing_packages))
        return False

    # Summary
    print(f"\n📊 Configuration Summary:")
    if deepseek_key:
        print("✅ Environment is properly configured for Aurora!")
        print("✅ You can use DeepSeek AI for speech analysis")
        print("✅ Database functionality will work")
        if not tavus_key:
            print("⚠️  Tavus API key missing (only needed for video avatar features)")
    else:
        print("⚠️  Environment partially configured")
        print("❌ DeepSeek API key missing - will use fallback analysis")
        print("✅ Database functionality will still work")

    return True

def create_sample_env():
    """Create a sample .env file"""
    if os.path.exists('.env'):
        print("📄 .env file already exists")
        return

    sample_content = """# Aurora AI System Configuration
# Add your actual API keys here

# DeepSeek API Key (required for AI analysis)
# Get it from: https://platform.deepseek.com/
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# Tavus API Key (optional - only for video avatar features)
# Get it from: https://tavusapi.com/
TAVUS_API_KEY=your_tavus_api_key_here
"""

    with open('.env', 'w') as f:
        f.write(sample_content)

    print("✅ Created sample .env file")
    print("📝 Please edit .env and add your actual API keys")

if __name__ == "__main__":
    print("Checking current directory:", os.getcwd())

    if not check_environment():
        print("\n🔧 Would you like to create a sample .env file? (y/n)")
        choice = input().lower().strip()
        if choice in ['y', 'yes']:
            create_sample_env()

    print(f"\n{'='*50}")
    print("Next steps:")
    print("1. Make sure your .env file has valid API keys")
    print("2. Run: python final_aurora.py")
    print("3. Run: python test_database.py")