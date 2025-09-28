# 🧠 Aurora Memory System Setup

Complete setup guide for the OpenAI-powered conversation processing system for Tavus CVI.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Environment Setup

Create a `.env` file in the root directory:

```env
# OpenAI API Key (required)
OPENAI_API_KEY=your_openai_api_key_here

# Tavus API Key (for optional direct API calls)
TAVUS_API_KEY=your_tavus_api_key_here
```

### 3. Test the System

```bash
# Test memory extraction
python aurora_memory_system.py test

# Start webhook server
python aurora_memory_system.py
```

## 🌐 Webhook Server Setup

### 1. Start the Server

```bash
python aurora_memory_system.py
```

The server runs on `http://localhost:5000` with these endpoints:
- `POST /webhook` - Tavus webhook handler
- `GET /memories` - Retrieve stored memories
- `GET /memories/summary` - Memory statistics
- `GET /health` - Health check

### 2. Expose with Ngrok

```bash
# Install ngrok first
ngrok http 5000
```

Copy the generated URL (e.g., `https://abc123.ngrok-free.app`)

### 3. Configure Tavus Webhook

When creating conversations, include the webhook URL:

```python
import requests

conversation_config = {
    "persona_id": "your_persona_id",
    "callback_url": "https://abc123.ngrok-free.app/webhook"
}

response = requests.post(
    "https://tavusapi.com/v2/conversations",
    headers={"x-api-key": "your_tavus_api_key"},
    json=conversation_config
)
```

## 🧠 How It Works

### Real-Time Processing

The system processes user messages as they happen:

1. **Utterance Event** → User speaks during conversation
2. **OpenAI Processing** → Extract important information
3. **Memory Storage** → Store if importance score ≥ 3

### Batch Processing

After conversations end:

1. **Transcription Ready** → Full conversation transcript received
2. **Batch Processing** → Process all user messages together
3. **Memory Extraction** → Extract and categorize user information

### Memory Categories

The system extracts:
- **Personal Info**: Name, age, location, occupation, family
- **Preferences**: Likes, dislikes, hobbies, interests, goals
- **Relationships**: Family, friends, colleagues
- **Context**: Current situation, projects, recent events
- **Emotional State**: Mood, stress levels, patterns

## 📊 Memory Structure

Each memory object contains:

```json
{
    "personal_info": ["Software engineer", "Lives in San Francisco"],
    "preferences": {
        "likes": ["hiking", "sci-fi books"],
        "dislikes": ["crowded places"],
        "interests": ["technology", "nature"],
        "goals": ["get promoted", "travel more"]
    },
    "relationships": ["married", "has sister in Boston"],
    "context": "Working on big project, planning wedding",
    "emotional_state": "stressed but excited",
    "conversation_summary": "Discussed work stress and upcoming wedding",
    "importance_score": 8,
    "memory_tags": ["work", "wedding", "stress", "personal"],
    "processed_at": "2024-01-15T10:30:00Z",
    "conversation_id": "c123456"
}
```

## 🔧 API Usage

### Get All Memories

```bash
curl http://localhost:5000/memories
```

### Get Memories for Specific Conversation

```bash
curl "http://localhost:5000/memories?conversation_id=c123456"
```

### Get Memory Statistics

```bash
curl http://localhost:5000/memories/summary
```

## 📝 Integration Examples

### Real-Time Message Processing

```python
from aurora_memory_system import OpenAIMemoryProcessor

processor = OpenAIMemoryProcessor()

# Process a user message
memory = processor.extract_user_memories(
    "Hi! I'm Sarah, 28, software engineer from SF. Getting married next month!",
    conversation_id="c123456"
)

print(f"Importance: {memory['importance_score']}/10")
print(f"Tags: {memory['memory_tags']}")
```

### Webhook Integration

```python
from aurora_memory_system import TavusWebhookHandler

handler = TavusWebhookHandler()

# Process Tavus webhook data
result = handler.handle_webhook_data(webhook_payload)
print(f"Status: {result['status']}")
```

## 🎯 Production Deployment

### Environment Variables

```env
OPENAI_API_KEY=sk-...
TAVUS_API_KEY=tvs_...
FLASK_ENV=production
```

### Database Integration

Replace `self.stored_memories = []` with proper database:

```python
# Example with PostgreSQL
import psycopg2

class DatabaseMemoryStorage:
    def store_memory(self, memory_data):
        # Insert into database
        pass

    def get_memories(self, conversation_id=None):
        # Query database
        pass
```

### Docker Deployment

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 5000

CMD ["python", "aurora_memory_system.py"]
```

## 🐛 Troubleshooting

### Common Issues

1. **OpenAI API Key Error**
   ```
   ❌ OPENAI_API_KEY not found in environment variables
   ```
   Solution: Add your OpenAI API key to `.env` file

2. **Webhook Not Receiving Data**
   - Check ngrok is running and URL is correct
   - Verify Tavus webhook URL includes `/webhook` path
   - Check server logs for errors

3. **Memory Extraction Failing**
   - Verify OpenAI API key has sufficient credits
   - Check network connectivity
   - Review error logs for JSON parsing issues

### Debug Mode

```python
# Enable verbose logging
import logging
logging.basicConfig(level=logging.DEBUG)

# Test with sample data
python aurora_memory_system.py test
```

## 📈 Performance Tips

1. **Batch Processing**: Process multiple messages together for better context
2. **Importance Filtering**: Only store memories with score ≥ 3
3. **Rate Limiting**: Add delays between OpenAI API calls
4. **Caching**: Cache processed memories to avoid reprocessing

## 🔒 Security

- Never commit API keys to git
- Use environment variables for secrets
- Validate webhook data before processing
- Consider adding authentication to memory endpoints

## 🤝 Support

If you encounter issues:
1. Check the troubleshooting section
2. Review server logs
3. Test with the included examples
4. Verify all environment variables are set

---

*"The boundary between self and others is the most private and sacred human boundary."* - Aurora 🧠