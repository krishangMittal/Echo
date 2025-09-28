# Aurora Futuristic Interface

A cyberpunk-style AI chat interface with transparent avatar, real-time metrics, and conversation timeline.

## Features

🎭 **Transparent Avatar**: WebGL-powered chroma key video with holographic effects
📊 **Live Metrics**: Real-time relationship, trust levels, and emotion tracking
📈 **Memory Evolution**: Scrollable conversation timeline with analysis tags
🌌 **Aesthetic Effects**: Cyber grid, particle fields, neon glows, neural animations

## Quick Start

### 1. Install Dependencies
```bash
cd aurora-futuristic-app
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

### 3. Open in Browser
Navigate to: http://localhost:3000

### 4. Connect to Aurora
- Enter your Tavus API token when prompted
- Get your API key from: https://platform.tavus.io/api-keys
- Make sure your Aurora backend is running on http://localhost:8000

## Backend Requirements

Your Aurora backend should provide these endpoints:
- `GET /api/integration-status?user_id={USER_ID}` - Memory system status
- `POST /api/start-conversation?user_id={USER_ID}` - Create conversation
- `POST /api/process-speech` - Process user speech
- `GET /api/metrics` - Get current metrics

## Project Structure

```
aurora-futuristic-app/
├── src/
│   ├── components/
│   │   └── FuturisticAuroraInterface.tsx
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── package.json
└── vite.config.ts
```

## Build for Production

```bash
npm run build
npm run preview
```

## Technologies Used

- **React 18** with TypeScript
- **Daily.co** for video calls
- **WebGL** for chroma key effects
- **Vite** for fast development
- **Orbitron font** for cyberpunk aesthetic

## Customization

Edit `FuturisticAuroraInterface.tsx` to:
- Adjust colors and animations
- Modify chroma key parameters
- Add new metric displays
- Change layout structure

The interface uses inline styles for easy customization and self-contained deployment.