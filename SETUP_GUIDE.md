# Aurora Real-time Processing System - Setup Guide

## Prerequisites

- Python 3.8+
- ngrok installed and configured
- Tavus API key
- OpenAI API key

## Installation

### 1. Install Python dependencies:

```bash
pip install fastapi uvicorn requests openai python-dotenv
```

Or use the requirements file:

```bash
pip install -r requirements.txt
```

### 2. Create .env file with your API keys:

```env
TAVUS_API_KEY=your_tavus_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Start ngrok tunnel:

```bash
ngrok http 8000
```

Keep this terminal open and note the https URL (e.g., `https://abc123.ngrok.io`)

## Running the System

### 1. Start the Python server:

```bash
python final_aurora.py
```

### 2. Create a conversation:

```bash
curl -X POST "https://YOUR_NGROK_URL/api/create-conversation"
```

Note the `conversation_url` from the response.

### 3. Update HTML client:

- Edit `aurora_client.html`
- Replace the conversation URL with your new one
- Update `BACKEND_URL` to your ngrok URL

### 4. Open the HTML file in your browser

## Usage

1. The HTML page will connect to the Tavus conversation
2. Start speaking to Aurora in the video call
3. Your speech gets captured and processed in real-time
4. Check live metrics at: `https://YOUR_NGROK_URL/api/metrics`

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/metrics` | GET | Current relationship/trust/emotion metrics |
| `/api/speeches` | GET | All processed conversations |
| `/api/process-speech` | POST | Process speech manually |
| `/api/reset` | DELETE | Reset all data |

## Troubleshooting

### No speech capture
- Check browser console for errors
- Verify ngrok tunnel is active
- Ensure microphone permissions are granted

### API errors
- Verify your API keys in `.env` file
- Check if API keys have proper permissions
- Ensure OpenAI account has credits

### Connection issues
- Ensure ngrok tunnel is active and accessible
- Check firewall settings
- Verify CORS settings in the backend

### Metrics not updating
- Check if speech is reaching `/api/process-speech`
- Monitor server logs for processing errors
- Verify webhook URL configuration

## File Structure

```
Ghost in the Shell/
├── final_aurora.py          # Main Aurora system
├── aurora_client.html       # Client interface
├── requirements.txt         # Python dependencies
├── .env                     # API keys (create this)
├── .gitignore              # Git ignore rules
└── SETUP_GUIDE.md          # This file
```

## Quick Start Commands

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Create .env file (add your API keys)
echo "TAVUS_API_KEY=your_key_here" > .env
echo "OPENAI_API_KEY=your_key_here" >> .env

# 3. Start ngrok (in separate terminal)
ngrok http 8000

# 4. Start Aurora system
python final_aurora.py

# 5. Open aurora_client.html in browser
```

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Verify all prerequisites are installed
3. Ensure API keys are valid and have proper permissions
4. Check server logs for detailed error messages
