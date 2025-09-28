#!/bin/bash
# Activation script for the Assistant project

echo "🚀 Activating Python virtual environment..."
source venv/bin/activate

echo "✅ Virtual environment activated!"
echo "📁 Current directory: $(pwd)"
echo "🐍 Python version: $(python --version)"
echo "📦 Pip version: $(pip --version)"

echo ""
echo "🔑 Don't forget to:"
echo "   1. Add your Gemini API key to the .env file"
echo "   2. Get your API key from: https://makersuite.google.com/app/apikey"
echo ""
echo "🚀 To start the server, run:"
echo "   uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000"
echo ""
