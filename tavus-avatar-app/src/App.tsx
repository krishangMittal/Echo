import { useState, useEffect, useRef, useMemo } from "react";
import {
  useDaily,
  DailyVideo,
  useParticipantIds,
  useLocalSessionId,
  useAudioTrack,
  DailyAudio,
} from "@daily-co/daily-react";

// WebGL Shader Programs for Chroma Key Effect
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

    // More aggressive green screen removal
    float alpha = smoothstep(u_threshold - 0.1, u_threshold + 0.1, diff);

    // Also check for green dominance
    float greenDominance = color.g - max(color.r, color.b);
    if (greenDominance > 0.3 && color.g > 0.5) {
      alpha = 0.0;
    }

    gl_FragColor = vec4(color.rgb, alpha);
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

  // Enable blending for transparency
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

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

// Transparent Video Component with Chroma Key
const TransparentVideo = ({ id }: { id: string }) => {
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

        // Clear with transparent background
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

        gl.uniform1i(imageLocation, 0);
        gl.uniform3f(keyColorLocation, 0.0, 1.0, 0.0); // Pure green (0, 255, 0)
        gl.uniform1f(thresholdLocation, 0.35); // Adjusted sensitivity

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
    </div>
  );
};

// Call Component
const Call = ({ onLeave }: { onLeave: () => void }) => {
  const remoteParticipantIds = useParticipantIds({ filter: "remote" });
  const localParticipantId = useLocalSessionId();
  const localAudio = useAudioTrack(localParticipantId);
  const daily = useDaily();
  const isMicEnabled = !localAudio.isOff;

  const toggleMicrophone = () => {
    daily?.setLocalAudio(!isMicEnabled);
  };

  return (
    <div className="call-interface">
      <div className="avatar-display">
        {remoteParticipantIds.length > 0 ? (
          <TransparentVideo id={remoteParticipantIds[0]} />
        ) : (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Connecting to Avatar...</p>
          </div>
        )}
      </div>

      <div className="controls">
        <button
          className={`control-btn ${isMicEnabled ? 'mic-on' : 'mic-off'}`}
          onClick={toggleMicrophone}
        >
          {isMicEnabled ? 'Mic On' : 'Mic Off'}
        </button>
        <button className="control-btn leave-btn" onClick={onLeave}>
          End Session
        </button>
      </div>

      <DailyAudio />
    </div>
  );
};

// Conversation Interface
interface IConversation {
  conversation_id: string;
  conversation_url: string;
  persona_id: string;
  status: string;
}

const createConversation = async (): Promise<IConversation> => {
  console.log('Creating conversation via local backend...');

  const response = await fetch('http://localhost:8000/api/create-conversation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  console.log('Conversation created:', data);

  return {
    conversation_id: data.conversation_id,
    conversation_url: data.conversation_url,
    persona_id: data.persona_id,
    status: 'created'
  };
};

const endConversation = async (conversationId: string) => {
  try {
    console.log('Ending conversation:', conversationId);
    // You can add a backend endpoint for this if needed
    // await fetch(`http://localhost:8000/api/end-conversation/${conversationId}`, {
    //   method: 'DELETE',
    // });
  } catch (error) {
    console.error('Failed to end conversation:', error);
  }
};

// Main App Component
function App() {
  const [conversation, setConversation] = useState<IConversation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const daily = useDaily();

  const handleStartCall = async () => {
    if (daily) {
      setLoading(true);
      setError(null);

      try {
        const conversationData = await createConversation();
        await daily.join({ url: conversationData.conversation_url });
        setConversation(conversationData);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        setError(`Failed to start conversation: ${errorMessage}`);
      }
      setLoading(false);
    }
  };

  const handleLeaveCall = () => {
    if (conversation) {
      endConversation(conversation.conversation_id);
    }
    daily?.leave();
    setConversation(null);
  };

  return (
    <div className="app">
      {/* Background Effects */}
      <div className="background">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
      </div>

      <div className="content">
        {!conversation ? (
          /* Landing Page */
          <div className="landing">
            <div className="hero">
              <h1 className="title">
                <span className="tavus-text">TAVUS</span>
              </h1>
              <p className="subtitle">Next-generation AI avatar with transparent background</p>
            </div>

            <div className="form">
              <button
                onClick={handleStartCall}
                disabled={loading || !!conversation}
                className={`button ${loading ? 'disabled' : ''}`}
              >
                {loading ? (
                  <div className="button-loading">
                    <div className="spinner small"></div>
                    <span>Creating Session...</span>
                  </div>
                ) : (
                  'Start Conversation'
                )}
              </button>
            </div>

            {error && (
              <div className="error">
                <div className="error-title">Error:</div>
                <div className="error-message">{error}</div>
              </div>
            )}
          </div>
        ) : (
          /* Avatar Interface */
          <Call onLeave={handleLeaveCall} />
        )}
      </div>

      <style jsx>{`
        .app {
          min-height: 100vh;
          background: linear-gradient(135deg, #0f0f23 0%, #000000 50%, #1a1a2e 100%);
          color: white;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .background {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .gradient-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          opacity: 0.3;
          animation: float 6s ease-in-out infinite;
        }

        .orb-1 {
          width: 300px;
          height: 300px;
          background: linear-gradient(45deg, #00d4ff, #0066ff);
          top: 20%;
          left: 20%;
          animation-delay: 0s;
        }

        .orb-2 {
          width: 200px;
          height: 200px;
          background: linear-gradient(45deg, #ff0080, #7928ca);
          bottom: 30%;
          right: 20%;
          animation-delay: 2s;
        }

        .orb-3 {
          width: 150px;
          height: 150px;
          background: linear-gradient(45deg, #00ff88, #00d4ff);
          top: 60%;
          left: 60%;
          animation-delay: 4s;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-20px) scale(1.1); }
        }

        .content {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 1200px;
          padding: 2rem;
        }

        .landing {
          text-align: center;
          max-width: 500px;
          margin: 0 auto;
        }

        .hero {
          margin-bottom: 3rem;
        }

        .title {
          font-size: 4rem;
          font-weight: 100;
          letter-spacing: 0.2em;
          margin-bottom: 1rem;
        }

        .tavus-text {
          background: linear-gradient(45deg, #00d4ff, #0066ff, #7928ca);
          background-size: 300% 300%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: gradient 3s ease infinite;
        }

        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .subtitle {
          font-size: 1.2rem;
          font-weight: 300;
          color: #a0a0a0;
          line-height: 1.6;
        }

        .form {
          margin-bottom: 2rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .label {
          font-size: 0.9rem;
          color: #b0b0b0;
          text-align: left;
        }

        .link {
          color: #00d4ff;
          text-decoration: none;
          transition: color 0.3s ease;
        }

        .link:hover {
          color: #0066ff;
        }

        .input {
          padding: 1rem;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: white;
          font-size: 1rem;
          transition: all 0.3s ease;
          backdrop-filter: blur(10px);
        }

        .input:focus {
          outline: none;
          border-color: #00d4ff;
          box-shadow: 0 0 20px rgba(0, 212, 255, 0.3);
        }

        .input::placeholder {
          color: #666;
        }

        .button {
          padding: 1rem 2rem;
          background: linear-gradient(45deg, #00d4ff, #0066ff);
          border: none;
          border-radius: 12px;
          color: white;
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 10px 30px rgba(0, 212, 255, 0.3);
        }

        .button:hover:not(.disabled) {
          transform: translateY(-2px);
          box-shadow: 0 15px 40px rgba(0, 212, 255, 0.4);
        }

        .button.disabled {
          background: rgba(100, 100, 100, 0.3);
          cursor: not-allowed;
          box-shadow: none;
        }

        .button-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .spinner.small {
          width: 16px;
          height: 16px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .error {
          background: rgba(255, 0, 80, 0.1);
          border: 1px solid rgba(255, 0, 80, 0.3);
          border-radius: 12px;
          padding: 1rem;
          color: #ff0080;
          font-size: 0.9rem;
        }

        .error-title {
          font-weight: 600;
          margin-bottom: 0.5rem;
        }

        .call-interface {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2rem;
        }

        .avatar-display {
          width: 400px;
          height: 400px;
          border-radius: 20px;
          overflow: hidden;
          background: rgba(0, 0, 0, 0.2);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .avatar-container {
          width: 100%;
          height: 100%;
          position: relative;
        }

        .avatar-canvas {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .loading-state {
          text-align: center;
          color: #a0a0a0;
        }

        .loading-state .spinner {
          width: 40px;
          height: 40px;
          margin-bottom: 1rem;
        }

        .controls {
          display: flex;
          gap: 1rem;
        }

        .control-btn {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 10px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .mic-on {
          background: rgba(0, 255, 100, 0.2);
          color: #00ff64;
          border: 1px solid rgba(0, 255, 100, 0.3);
        }

        .mic-off {
          background: rgba(255, 100, 100, 0.2);
          color: #ff6464;
          border: 1px solid rgba(255, 100, 100, 0.3);
        }

        .leave-btn {
          background: rgba(255, 0, 80, 0.2);
          color: #ff0080;
          border: 1px solid rgba(255, 0, 80, 0.3);
        }

        .control-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
        }
      `}</style>
    </div>
  );
}

export default App;