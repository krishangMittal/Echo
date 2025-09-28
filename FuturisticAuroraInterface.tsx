import { useState, useEffect, useRef, useMemo } from "react";
import {
  useDaily,
  DailyVideo,
  useParticipantIds,
  useLocalSessionId,
  useAudioTrack,
  DailyAudio,
} from "@daily-co/daily-react";

// WebGL Shaders for Chroma Key Effect (same as your original)
const vertexShaderSource = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0, 1);
    v_texCoord = vec2(a_texCoord.x, 1.0 - a_texCoord.y);
  }
`;

const fragmentShaderSource = `
  precision mediump float;
  uniform sampler2D u_image;
  varying vec2 v_texCoord;
  uniform vec3 u_keyColor;
  uniform float u_threshold;
  void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    float diff = length(color.rgb - u_keyColor);
    gl_FragColor = diff < u_threshold ? vec4(0.0) : color;
  }
`;

const initShader = (gl: WebGLRenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
};

const initWebGL = (gl: WebGLRenderingContext) => {
  const program = gl.createProgram()!;
  gl.attachShader(program, initShader(gl, gl.VERTEX_SHADER, vertexShaderSource));
  gl.attachShader(program, initShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource));
  gl.linkProgram(program);
  gl.useProgram(program);

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  const texCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);

  const positionLocation = gl.getAttribLocation(program, "a_position");
  const texCoordLocation = gl.getAttribLocation(program, "a_texCoord");

  gl.enableVertexAttribArray(positionLocation);
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  gl.enableVertexAttribArray(texCoordLocation);
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  return {
    program,
    texture,
    imageLocation: gl.getUniformLocation(program, "u_image"),
    keyColorLocation: gl.getUniformLocation(program, "u_keyColor"),
    thresholdLocation: gl.getUniformLocation(program, "u_threshold"),
  };
};

// Futuristic Video Component with Chroma Key
const TransparentAvatar: React.FC<{ id: string }> = ({ id }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const glRef = useRef<WebGLRenderingContext | null>(null);

  const webGLContext = useMemo(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const gl = canvas.getContext("webgl", {
        premultipliedAlpha: false,
        alpha: true,
      });
      if (gl) {
        glRef.current = gl;
        return initWebGL(gl);
      }
    }
    return null;
  }, [canvasRef.current]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      const checkVideoReady = () => {
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          setIsVideoReady(true);
          video.removeEventListener("canplay", checkVideoReady);
        }
      };
      video.addEventListener("canplay", checkVideoReady);
      return () => video.removeEventListener("canplay", checkVideoReady);
    }
  }, []);

  useEffect(() => {
    if (!isVideoReady || !webGLContext) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const gl = glRef.current;
    if (!video || !canvas || !gl) return;

    const { program, texture, imageLocation, keyColorLocation, thresholdLocation } = webGLContext;

    let animationFrameId: number;
    let lastFrameTime = 0;
    const targetFPS = 30;
    const frameInterval = 1000 / targetFPS;

    const applyChromaKey = (currentTime: number) => {
      if (currentTime - lastFrameTime < frameInterval) {
        animationFrameId = requestAnimationFrame(applyChromaKey);
        return;
      }

      lastFrameTime = currentTime;

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

        gl.uniform1i(imageLocation, 0);
        gl.uniform3f(keyColorLocation, 3 / 255, 255 / 255, 156 / 255);
        gl.uniform1f(thresholdLocation, 0.3);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }

      animationFrameId = requestAnimationFrame(applyChromaKey);
    };

    applyChromaKey(0);

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (gl && program && texture) {
        gl.deleteProgram(program);
        gl.deleteTexture(texture);
      }
    };
  }, [isVideoReady, webGLContext]);

  return (
    <div className="avatar-container">
      <DailyVideo
        sessionId={id}
        type="video"
        ref={videoRef}
        style={{ display: "none" }}
      />
      <canvas
        ref={canvasRef}
        className="avatar-canvas"
      />
      <div className="hologram-effect"></div>
    </div>
  );
};

// Metrics Panel Component
const MetricsPanel: React.FC<{ metrics: any }> = ({ metrics }) => {
  return (
    <div className="metrics-panel">
      <div className="metric-card">
        <div className="metric-label">RELATIONSHIP</div>
        <div className="metric-value">{metrics?.relationship_level?.toFixed(1) || "0.0"}</div>
        <div className="metric-bar">
          <div
            className="metric-fill relationship"
            style={{ width: `${metrics?.relationship_level || 0}%` }}
          ></div>
        </div>
      </div>

      <div className="metric-card">
        <div className="metric-label">TRUST LEVEL</div>
        <div className="metric-value">{metrics?.trust_level?.toFixed(1) || "0.0"}</div>
        <div className="metric-bar">
          <div
            className="metric-fill trust"
            style={{ width: `${metrics?.trust_level || 0}%` }}
          ></div>
        </div>
      </div>

      <div className="metric-card">
        <div className="metric-label">EMOTION</div>
        <div className="metric-value emotional">{metrics?.current_emotion || "NEUTRAL"}</div>
      </div>

      <div className="metric-card">
        <div className="metric-label">MEMORIES</div>
        <div className="metric-value">{metrics?.total_memories || "0"}</div>
      </div>
    </div>
  );
};

// Conversation Timeline Component
const ConversationTimeline: React.FC<{ messages: any[] }> = ({ messages }) => {
  return (
    <div className="timeline-container">
      <div className="timeline-header">
        <div className="timeline-title">MEMORY EVOLUTION</div>
      </div>
      <div className="timeline-scroll">
        {messages.map((message, index) => (
          <div key={index} className={`timeline-item ${message.type}`}>
            <div className="timeline-dot"></div>
            <div className="timeline-content">
              <div className="timeline-time">{message.timestamp}</div>
              <div className="timeline-text">{message.text}</div>
              {message.analysis && (
                <div className="timeline-analysis">
                  <span className="analysis-tag topic">{message.analysis.topic}</span>
                  <span className="analysis-tag emotion">{message.analysis.emotion}</span>
                  <span className="analysis-tag importance">IMP: {message.analysis.importance}/10</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Main Futuristic Aurora Interface
const FuturisticAuroraInterface = () => {
  const [messages, setMessages] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>({});
  const [connectionStatus, setConnectionStatus] = useState("INITIALIZING");
  const [conversation, setConversation] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const remoteParticipantIds = useParticipantIds({ filter: "remote" });
  const localParticipantId = useLocalSessionId();
  const localAudio = useAudioTrack(localParticipantId);
  const daily = useDaily();
  const isMicEnabled = !localAudio.isOff;

  const BACKEND_URL = "http://localhost:8000";
  const USER_ID = "abiodun";

  // Initialize Aurora connection
  useEffect(() => {
    initializeAurora();
  }, []);

  // Get metrics periodically
  useEffect(() => {
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  const addMessage = (text: string, type: string = 'system', analysis?: any) => {
    const newMessage = {
      text,
      type,
      timestamp: new Date().toLocaleTimeString(),
      analysis
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const fetchMetrics = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/metrics`);
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    }
  };

  const initializeAurora = async () => {
    setLoading(true);
    setConnectionStatus("CONNECTING");

    try {
      // Get integration status
      const statusResponse = await fetch(`${BACKEND_URL}/api/integration-status?user_id=${USER_ID}`);
      const statusData = await statusResponse.json();

      addMessage(`Memory system initialized: ${statusData.user_profile?.total_memories || 0} memories loaded`, 'system');

      // Start conversation
      const response = await fetch(`${BACKEND_URL}/api/start-conversation?user_id=${USER_ID}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'}
      });
      const data = await response.json();

      if (data.conversation_id && daily) {
        await daily.join({ url: data.conversation_url });
        setConversation(data);
        setConnectionStatus("CONNECTED");
        addMessage(`Aurora connection established`, 'system');
      }
    } catch (error) {
      setConnectionStatus("ERROR");
      addMessage(`Connection failed: ${error}`, 'system');
    }

    setLoading(false);
  };

  const toggleMicrophone = () => {
    daily?.setLocalAudio(!isMicEnabled);
  };

  const handleLeaveCall = () => {
    daily?.leave();
    setConversation(null);
    setConnectionStatus("DISCONNECTED");
  };

  return (
    <div className="aurora-interface">
      {/* Background Effects */}
      <div className="cyber-grid"></div>
      <div className="particle-field"></div>

      {/* Header */}
      <header className="interface-header">
        <div className="system-logo">
          <div className="logo-text">AURORA</div>
          <div className="logo-subtitle">Neural Interface v2.0</div>
        </div>
        <div className={`connection-status ${connectionStatus.toLowerCase()}`}>
          <div className="status-indicator"></div>
          <span>{connectionStatus}</span>
        </div>
      </header>

      {/* Main Interface Grid */}
      <div className="main-grid">
        {/* Left Panel - Metrics */}
        <div className="left-panel">
          <MetricsPanel metrics={metrics} />

          {/* Controls */}
          <div className="control-panel">
            <button
              className={`control-btn ${isMicEnabled ? 'active' : ''}`}
              onClick={toggleMicrophone}
            >
              <div className="btn-icon">🎤</div>
              <div className="btn-label">{isMicEnabled ? 'MIC ON' : 'MIC OFF'}</div>
            </button>

            <button
              className="control-btn disconnect"
              onClick={handleLeaveCall}
            >
              <div className="btn-icon">⏻</div>
              <div className="btn-label">DISCONNECT</div>
            </button>
          </div>
        </div>

        {/* Center - Avatar */}
        <div className="center-panel">
          <div className="avatar-frame">
            {remoteParticipantIds.length > 0 ? (
              <TransparentAvatar id={remoteParticipantIds[0]} />
            ) : (
              <div className="loading-avatar">
                <div className="pulse-ring"></div>
                <div className="loading-text">INITIALIZING AVATAR</div>
              </div>
            )}
          </div>

          {/* Neural Activity Visualization */}
          <div className="neural-activity">
            <div className="neural-wave"></div>
            <div className="neural-pulse"></div>
          </div>
        </div>

        {/* Right Panel - Timeline */}
        <div className="right-panel">
          <ConversationTimeline messages={messages} />
        </div>
      </div>

      {/* Audio Component */}
      <DailyAudio />

      {/* CSS Styles */}
      <style jsx>{`
        .aurora-interface {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: radial-gradient(circle at center, #0a0a1a 0%, #000 100%);
          color: #00ffff;
          font-family: 'Orbitron', 'Arial', monospace;
          overflow: hidden;
        }

        .cyber-grid {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-image:
            linear-gradient(rgba(0, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 255, 255, 0.1) 1px, transparent 1px);
          background-size: 50px 50px;
          animation: gridShift 20s linear infinite;
          z-index: 1;
        }

        @keyframes gridShift {
          0% { transform: translate(0, 0); }
          100% { transform: translate(50px, 50px); }
        }

        .particle-field {
          position: absolute;
          width: 100%;
          height: 100%;
          background: radial-gradient(circle at 20% 80%, rgba(0, 255, 255, 0.1) 0%, transparent 50%),
                      radial-gradient(circle at 80% 20%, rgba(255, 0, 255, 0.1) 0%, transparent 50%);
          animation: particleFloat 15s ease-in-out infinite;
          z-index: 1;
        }

        @keyframes particleFloat {
          0%, 100% { transform: scale(1) rotate(0deg); }
          50% { transform: scale(1.1) rotate(180deg); }
        }

        .interface-header {
          position: relative;
          z-index: 10;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 40px;
          border-bottom: 1px solid rgba(0, 255, 255, 0.3);
          backdrop-filter: blur(10px);
        }

        .system-logo {
          text-align: left;
        }

        .logo-text {
          font-size: 2rem;
          font-weight: bold;
          color: #00ffff;
          text-shadow: 0 0 10px #00ffff;
          letter-spacing: 3px;
        }

        .logo-subtitle {
          font-size: 0.8rem;
          color: rgba(0, 255, 255, 0.7);
          margin-top: 2px;
        }

        .connection-status {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 16px;
          border: 1px solid rgba(0, 255, 255, 0.3);
          border-radius: 20px;
          backdrop-filter: blur(5px);
        }

        .status-indicator {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #ff0000;
          animation: pulse 2s infinite;
        }

        .connection-status.connected .status-indicator {
          background: #00ff00;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        .main-grid {
          position: relative;
          z-index: 10;
          display: grid;
          grid-template-columns: 300px 1fr 350px;
          height: calc(100vh - 100px);
          gap: 20px;
          padding: 20px;
        }

        .left-panel, .right-panel {
          backdrop-filter: blur(10px);
          border: 1px solid rgba(0, 255, 255, 0.2);
          border-radius: 10px;
          padding: 20px;
          background: rgba(0, 20, 40, 0.3);
        }

        .metrics-panel {
          display: flex;
          flex-direction: column;
          gap: 15px;
          margin-bottom: 30px;
        }

        .metric-card {
          padding: 15px;
          border: 1px solid rgba(0, 255, 255, 0.3);
          border-radius: 8px;
          background: rgba(0, 30, 60, 0.4);
        }

        .metric-label {
          font-size: 0.7rem;
          color: rgba(0, 255, 255, 0.8);
          margin-bottom: 5px;
          letter-spacing: 1px;
        }

        .metric-value {
          font-size: 1.2rem;
          font-weight: bold;
          color: #00ffff;
          margin-bottom: 8px;
        }

        .metric-value.emotional {
          color: #ff00ff;
          text-shadow: 0 0 5px #ff00ff;
        }

        .metric-bar {
          height: 4px;
          background: rgba(0, 255, 255, 0.2);
          border-radius: 2px;
          overflow: hidden;
        }

        .metric-fill {
          height: 100%;
          transition: width 0.5s ease;
          border-radius: 2px;
        }

        .metric-fill.relationship {
          background: linear-gradient(90deg, #00ffff, #0080ff);
          box-shadow: 0 0 5px #00ffff;
        }

        .metric-fill.trust {
          background: linear-gradient(90deg, #00ff80, #00ffff);
          box-shadow: 0 0 5px #00ff80;
        }

        .control-panel {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .control-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          background: rgba(0, 30, 60, 0.6);
          border: 1px solid rgba(0, 255, 255, 0.3);
          border-radius: 8px;
          color: #00ffff;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .control-btn:hover {
          background: rgba(0, 50, 100, 0.8);
          border-color: #00ffff;
          box-shadow: 0 0 10px rgba(0, 255, 255, 0.3);
        }

        .control-btn.active {
          background: rgba(0, 100, 200, 0.6);
          border-color: #00ff00;
          color: #00ff00;
        }

        .control-btn.disconnect {
          border-color: #ff4444;
          color: #ff4444;
        }

        .center-panel {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .avatar-frame {
          position: relative;
          width: 400px;
          height: 400px;
          border: 2px solid rgba(0, 255, 255, 0.5);
          border-radius: 50%;
          background: radial-gradient(circle, rgba(0, 255, 255, 0.1) 0%, transparent 70%);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: avatarGlow 3s ease-in-out infinite;
        }

        @keyframes avatarGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(0, 255, 255, 0.3); }
          50% { box-shadow: 0 0 40px rgba(0, 255, 255, 0.6); }
        }

        .avatar-container {
          position: relative;
          width: 350px;
          height: 350px;
          border-radius: 50%;
          overflow: hidden;
        }

        .avatar-canvas {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border-radius: 50%;
        }

        .hologram-effect {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: linear-gradient(45deg,
            transparent 30%,
            rgba(0, 255, 255, 0.1) 50%,
            transparent 70%);
          animation: hologramScan 2s linear infinite;
        }

        @keyframes hologramScan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }

        .loading-avatar {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
        }

        .pulse-ring {
          width: 100px;
          height: 100px;
          border: 2px solid #00ffff;
          border-radius: 50%;
          animation: pulseRing 2s infinite;
        }

        @keyframes pulseRing {
          0% { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }

        .loading-text {
          margin-top: 20px;
          font-size: 0.8rem;
          color: rgba(0, 255, 255, 0.8);
          letter-spacing: 2px;
        }

        .neural-activity {
          position: absolute;
          bottom: -50px;
          left: 50%;
          transform: translateX(-50%);
          width: 200px;
          height: 30px;
        }

        .neural-wave {
          width: 100%;
          height: 2px;
          background: linear-gradient(90deg, transparent, #00ffff, transparent);
          animation: neuralWave 3s ease-in-out infinite;
        }

        @keyframes neuralWave {
          0%, 100% { transform: scaleX(0.5); opacity: 0.5; }
          50% { transform: scaleX(1.5); opacity: 1; }
        }

        .timeline-container {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .timeline-header {
          padding-bottom: 15px;
          border-bottom: 1px solid rgba(0, 255, 255, 0.3);
          margin-bottom: 20px;
        }

        .timeline-title {
          font-size: 0.9rem;
          color: #00ffff;
          letter-spacing: 2px;
          text-align: center;
        }

        .timeline-scroll {
          flex: 1;
          overflow-y: auto;
          padding-right: 10px;
        }

        .timeline-item {
          position: relative;
          padding-left: 30px;
          margin-bottom: 20px;
          border-left: 1px solid rgba(0, 255, 255, 0.3);
        }

        .timeline-dot {
          position: absolute;
          left: -4px;
          top: 5px;
          width: 8px;
          height: 8px;
          background: #00ffff;
          border-radius: 50%;
          box-shadow: 0 0 5px #00ffff;
        }

        .timeline-item.user .timeline-dot {
          background: #00ff80;
          box-shadow: 0 0 5px #00ff80;
        }

        .timeline-item.replica .timeline-dot {
          background: #ff00ff;
          box-shadow: 0 0 5px #ff00ff;
        }

        .timeline-content {
          background: rgba(0, 20, 40, 0.4);
          padding: 12px;
          border-radius: 8px;
          border: 1px solid rgba(0, 255, 255, 0.2);
        }

        .timeline-time {
          font-size: 0.7rem;
          color: rgba(0, 255, 255, 0.6);
          margin-bottom: 5px;
        }

        .timeline-text {
          font-size: 0.8rem;
          line-height: 1.4;
          margin-bottom: 8px;
        }

        .timeline-analysis {
          display: flex;
          gap: 5px;
          flex-wrap: wrap;
        }

        .analysis-tag {
          padding: 2px 6px;
          font-size: 0.6rem;
          border-radius: 10px;
          border: 1px solid;
        }

        .analysis-tag.topic {
          background: rgba(0, 255, 255, 0.1);
          border-color: #00ffff;
          color: #00ffff;
        }

        .analysis-tag.emotion {
          background: rgba(255, 0, 255, 0.1);
          border-color: #ff00ff;
          color: #ff00ff;
        }

        .analysis-tag.importance {
          background: rgba(255, 255, 0, 0.1);
          border-color: #ffff00;
          color: #ffff00;
        }

        /* Scrollbar Styling */
        .timeline-scroll::-webkit-scrollbar {
          width: 6px;
        }

        .timeline-scroll::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.3);
        }

        .timeline-scroll::-webkit-scrollbar-thumb {
          background: rgba(0, 255, 255, 0.3);
          border-radius: 3px;
        }

        .timeline-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 255, 255, 0.5);
        }
      `}</style>
    </div>
  );
};

export default FuturisticAuroraInterface;