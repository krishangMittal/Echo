import { useState, useEffect, useRef, useMemo } from "react";
import {
  useDaily,
  DailyVideo,
  useParticipantIds,
  useLocalSessionId,
  useAudioTrack,
  DailyAudio,
} from "@daily-co/daily-react";

// WebGL Shaders for Chroma Key Effect
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
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '380px',
      height: '380px',
      borderRadius: '50%',
      overflow: 'hidden',
      background: 'transparent'
    }}>
      <DailyVideo
        sessionId={id}
        type="video"
        ref={videoRef}
        style={{ display: "none" }}
      />
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          borderRadius: '50%',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          background: 'linear-gradient(45deg, transparent 30%, rgba(0, 255, 255, 0.1) 50%, transparent 70%)',
          animation: 'hologramScan 2s linear infinite',
        }}
      />
    </div>
  );
};

// Metrics Panel Component
const MetricsPanel: React.FC<{ metrics: any }> = ({ metrics }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '30px' }}>
      <div style={{
        padding: '15px',
        border: '1px solid rgba(0, 255, 255, 0.3)',
        borderRadius: '8px',
        background: 'rgba(0, 30, 60, 0.4)',
      }}>
        <div style={{ fontSize: '0.7rem', color: 'rgba(0, 255, 255, 0.8)', marginBottom: '5px', letterSpacing: '1px' }}>
          RELATIONSHIP
        </div>
        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#00ffff', marginBottom: '8px' }}>
          {metrics?.relationship_level?.toFixed(1) || "0.0"}
        </div>
        <div style={{ height: '4px', background: 'rgba(0, 255, 255, 0.2)', borderRadius: '2px', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${metrics?.relationship_level || 0}%`,
              background: 'linear-gradient(90deg, #00ffff, #0080ff)',
              boxShadow: '0 0 5px #00ffff',
              borderRadius: '2px',
              transition: 'width 0.5s ease',
            }}
          />
        </div>
      </div>

      <div style={{
        padding: '15px',
        border: '1px solid rgba(0, 255, 255, 0.3)',
        borderRadius: '8px',
        background: 'rgba(0, 30, 60, 0.4)',
      }}>
        <div style={{ fontSize: '0.7rem', color: 'rgba(0, 255, 255, 0.8)', marginBottom: '5px', letterSpacing: '1px' }}>
          TRUST LEVEL
        </div>
        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#00ffff', marginBottom: '8px' }}>
          {metrics?.trust_level?.toFixed(1) || "0.0"}
        </div>
        <div style={{ height: '4px', background: 'rgba(0, 255, 255, 0.2)', borderRadius: '2px', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${metrics?.trust_level || 0}%`,
              background: 'linear-gradient(90deg, #00ff80, #00ffff)',
              boxShadow: '0 0 5px #00ff80',
              borderRadius: '2px',
              transition: 'width 0.5s ease',
            }}
          />
        </div>
      </div>

      <div style={{
        padding: '15px',
        border: '1px solid rgba(0, 255, 255, 0.3)',
        borderRadius: '8px',
        background: 'rgba(0, 30, 60, 0.4)',
      }}>
        <div style={{ fontSize: '0.7rem', color: 'rgba(0, 255, 255, 0.8)', marginBottom: '5px', letterSpacing: '1px' }}>
          EMOTION
        </div>
        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#ff00ff', textShadow: '0 0 5px #ff00ff', marginBottom: '8px' }}>
          {metrics?.current_emotion || "NEUTRAL"}
        </div>
      </div>

      <div style={{
        padding: '15px',
        border: '1px solid rgba(0, 255, 255, 0.3)',
        borderRadius: '8px',
        background: 'rgba(0, 30, 60, 0.4)',
      }}>
        <div style={{ fontSize: '0.7rem', color: 'rgba(0, 255, 255, 0.8)', marginBottom: '5px', letterSpacing: '1px' }}>
          MEMORIES
        </div>
        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#00ffff', marginBottom: '8px' }}>
          {metrics?.total_memories || "0"}
        </div>
      </div>
    </div>
  );
};

// Conversation Timeline Component
const ConversationTimeline: React.FC<{ messages: any[] }> = ({ messages }) => {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ paddingBottom: '15px', borderBottom: '1px solid rgba(0, 255, 255, 0.3)', marginBottom: '20px' }}>
        <div style={{ fontSize: '0.9rem', color: '#00ffff', letterSpacing: '2px', textAlign: 'center' }}>
          MEMORY EVOLUTION
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '10px' }}>
        {messages.map((message, index) => (
          <div key={index} style={{ position: 'relative', paddingLeft: '30px', marginBottom: '20px', borderLeft: '1px solid rgba(0, 255, 255, 0.3)' }}>
            <div
              style={{
                position: 'absolute',
                left: '-4px',
                top: '5px',
                width: '8px',
                height: '8px',
                background: message.type === 'user' ? '#00ff80' : message.type === 'replica' ? '#ff00ff' : '#00ffff',
                borderRadius: '50%',
                boxShadow: `0 0 5px ${message.type === 'user' ? '#00ff80' : message.type === 'replica' ? '#ff00ff' : '#00ffff'}`,
              }}
            />
            <div style={{
              background: 'rgba(0, 20, 40, 0.4)',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid rgba(0, 255, 255, 0.2)',
            }}>
              <div style={{ fontSize: '0.7rem', color: 'rgba(0, 255, 255, 0.6)', marginBottom: '5px' }}>
                {message.timestamp}
              </div>
              <div style={{ fontSize: '0.8rem', lineHeight: '1.4', marginBottom: '8px' }}>
                {message.text}
              </div>
              {message.analysis && (
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  <span style={{
                    padding: '2px 6px',
                    fontSize: '0.6rem',
                    borderRadius: '10px',
                    border: '1px solid #00ffff',
                    background: 'rgba(0, 255, 255, 0.1)',
                    color: '#00ffff',
                  }}>
                    {message.analysis.topic}
                  </span>
                  <span style={{
                    padding: '2px 6px',
                    fontSize: '0.6rem',
                    borderRadius: '10px',
                    border: '1px solid #ff00ff',
                    background: 'rgba(255, 0, 255, 0.1)',
                    color: '#ff00ff',
                  }}>
                    {message.analysis.emotion}
                  </span>
                  <span style={{
                    padding: '2px 6px',
                    fontSize: '0.6rem',
                    borderRadius: '10px',
                    border: '1px solid #ffff00',
                    background: 'rgba(255, 255, 0, 0.1)',
                    color: '#ffff00',
                  }}>
                    IMP: {message.analysis.importance}/10
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Connection Screen Component
const ConnectionScreen: React.FC<{ onConnect: () => void; loading: boolean }> = ({ onConnect, loading }) => {
  const handleClick = () => {
    console.log('Button clicked in ConnectionScreen!');
    onConnect();
  };

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'rgba(0, 20, 40, 0.95)',
      padding: '40px',
      borderRadius: '15px',
      border: '2px solid rgba(0, 255, 255, 0.5)',
      backdropFilter: 'blur(10px)',
      textAlign: 'center',
      minWidth: '400px',
      zIndex: 100,
      boxShadow: '0 0 30px rgba(0, 255, 255, 0.2)',
    }}>
      <h2 style={{ color: '#00ffff', marginBottom: '20px', textShadow: '0 0 10px #00ffff' }}>
        AURORA NEURAL INTERFACE
      </h2>
      <p style={{ color: 'rgba(0, 255, 255, 0.8)', marginBottom: '30px', fontSize: '0.9rem' }}>
        Initialize connection to Aurora AI with persistent memory
      </p>
      <button
        onClick={handleClick}
        disabled={loading}
        style={{
          width: '100%',
          padding: '15px',
          background: loading ? 'rgba(0, 100, 200, 0.3)' : 'rgba(0, 100, 200, 0.8)',
          border: '2px solid #00ffff',
          borderRadius: '8px',
          color: '#00ffff',
          fontSize: '1rem',
          fontWeight: 'bold',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.3s ease',
          zIndex: 1000,
          position: 'relative',
          outline: 'none',
          textShadow: '0 0 5px #00ffff',
          boxShadow: loading ? 'none' : '0 0 15px rgba(0, 255, 255, 0.3)',
        }}
        onMouseEnter={(e) => {
          if (!loading) {
            e.target.style.background = 'rgba(0, 150, 255, 0.9)';
            e.target.style.boxShadow = '0 0 25px rgba(0, 255, 255, 0.5)';
          }
        }}
        onMouseLeave={(e) => {
          if (!loading) {
            e.target.style.background = 'rgba(0, 100, 200, 0.8)';
            e.target.style.boxShadow = '0 0 15px rgba(0, 255, 255, 0.3)';
          }
        }}
      >
        {loading ? 'CONNECTING...' : 'CONNECT TO AURORA'}
      </button>
      <p style={{ marginTop: '20px', fontSize: '0.7rem', color: 'rgba(0, 255, 255, 0.5)' }}>
        Establishing secure neural link to Aurora consciousness...
      </p>
    </div>
  );
};

// Main Futuristic Aurora Interface
const FuturisticAuroraInterface = () => {
  const [messages, setMessages] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>({});
  const [connectionStatus, setConnectionStatus] = useState("DISCONNECTED");
  const [conversation, setConversation] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showConnectionScreen, setShowConnectionScreen] = useState(true);

  const remoteParticipantIds = useParticipantIds({ filter: "remote" });
  const localParticipantId = useLocalSessionId();
  const localAudio = useAudioTrack(localParticipantId);
  const daily = useDaily();
  const isMicEnabled = !localAudio.isOff;

  const BACKEND_URL = "http://localhost:8000";
  const USER_ID = "abiodun";

  // Get metrics periodically
  useEffect(() => {
    if (conversation) {
      const interval = setInterval(fetchMetrics, 5000);
      return () => clearInterval(interval);
    }
  }, [conversation]);

  // Set up Daily.co event listeners
  useEffect(() => {
    if (!daily) return;

    const handleAppMessage = (event: any) => {
      const data = event.data;
      console.log('App message:', data);

      if (data.event_type === 'conversation.utterance') {
        const speech = data.properties.speech;
        const role = data.properties.role;

        if (role === 'user' && speech) {
          addMessage(`You said: ${speech}`, 'user');

          // Send to backend for processing with the conversation_id from your API
          if (conversation?.conversation_id) {
            fetch(`${BACKEND_URL}/api/process-speech`, {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({
                text: speech,
                conversation_id: conversation.conversation_id,
                user_id: conversation.user_id || USER_ID
              })
            })
            .then(response => response.json())
            .then(result => {
              const analysis = result.speech_record?.analysis;
              if (analysis) {
                addMessage(`Analysis: ${analysis.topic} | ${analysis.emotion} | Importance: ${analysis.importance}/10`, 'system', analysis);
              }
            })
            .catch(err => {
              addMessage(`Error processing speech: ${err}`, 'system');
            });
          }

        } else if (role === 'replica' && speech) {
          addMessage(`Aurora said: ${speech}`, 'replica');
        }
      }
      else if (data.event_type === 'conversation.user.started_speaking') {
        addMessage('You started speaking...', 'system');
      }
      else if (data.event_type === 'conversation.replica.started_speaking') {
        addMessage('Aurora is responding...', 'system');
      }
    };

    const handleJoinedMeeting = () => {
      setConnectionStatus("CONNECTED");
      addMessage('Connected to Aurora! Start speaking...', 'system');
    };

    const handleError = (error: any) => {
      addMessage(`Error: ${error}`, 'system');
      setConnectionStatus("ERROR");
    };

    daily.on('app-message', handleAppMessage);
    daily.on('joined-meeting', handleJoinedMeeting);
    daily.on('error', handleError);

    return () => {
      daily.off('app-message', handleAppMessage);
      daily.off('joined-meeting', handleJoinedMeeting);
      daily.off('error', handleError);
    };
  }, [daily, conversation]);

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

  const handleConnect = async () => {
    console.log('Connect button clicked!');
    setLoading(true);
    setConnectionStatus("CONNECTING");

    try {
      // Create conversation using your endpoint
      const createResponse = await fetch(`${BACKEND_URL}/api/create-conversation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const conversationData = await createResponse.json();

      addMessage(`Aurora conversation created: ${conversationData.conversation_id}`, 'system');
      addMessage(`Memory store: ${conversationData.memory_store}`, 'system');
      addMessage(`Aurora context loaded: ${conversationData.aurora_context}`, 'system');

      if (conversationData.conversation_url && daily) {
        await daily.join({ url: conversationData.conversation_url });
        setConversation(conversationData);
        setShowConnectionScreen(false);
        addMessage(`Neural link established to Aurora consciousness`, 'system');
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
    setShowConnectionScreen(true);
    setMessages([]);
  };

  if (showConnectionScreen) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'radial-gradient(circle at center, #0a0a1a 0%, #000 100%)',
        color: '#00ffff',
        fontFamily: 'Orbitron, Arial, monospace',
        overflow: 'hidden',
      }}>
        {/* Background Effects */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundImage: 'linear-gradient(rgba(0, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 255, 0.1) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
          animation: 'gridShift 20s linear infinite',
          zIndex: 1,
        }} />

        <ConnectionScreen onConnect={handleConnect} loading={loading} />

        <style>{`
          @keyframes gridShift {
            0% { transform: translate(0, 0); }
            100% { transform: translate(50px, 50px); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'radial-gradient(circle at center, #0a0a1a 0%, #000 100%)',
      color: '#00ffff',
      fontFamily: 'Orbitron, Arial, monospace',
      overflow: 'hidden',
    }}>
      {/* Background Effects */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundImage: 'linear-gradient(rgba(0, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 255, 0.1) 1px, transparent 1px)',
        backgroundSize: '50px 50px',
        animation: 'gridShift 20s linear infinite',
        zIndex: 1,
      }} />

      <div style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        background: 'radial-gradient(circle at 20% 80%, rgba(0, 255, 255, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255, 0, 255, 0.1) 0%, transparent 50%)',
        animation: 'particleFloat 15s ease-in-out infinite',
        zIndex: 1,
      }} />

      {/* Header */}
      <header style={{
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px 40px',
        borderBottom: '1px solid rgba(0, 255, 255, 0.3)',
        backdropFilter: 'blur(10px)',
      }}>
        <div style={{ textAlign: 'left' }}>
          <div style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            color: '#00ffff',
            textShadow: '0 0 10px #00ffff',
            letterSpacing: '3px',
          }}>
            AURORA
          </div>
          <div style={{
            fontSize: '0.8rem',
            color: 'rgba(0, 255, 255, 0.7)',
            marginTop: '2px',
          }}>
            Neural Interface v2.0
          </div>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '8px 16px',
          border: '1px solid rgba(0, 255, 255, 0.3)',
          borderRadius: '20px',
          backdropFilter: 'blur(5px)',
        }}>
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: connectionStatus === 'CONNECTED' ? '#00ff00' : '#ff0000',
            animation: 'pulse 2s infinite',
          }} />
          <span>{connectionStatus}</span>
        </div>
      </header>

      {/* Main Interface Grid */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        display: 'grid',
        gridTemplateColumns: '300px 1fr 350px',
        height: 'calc(100vh - 100px)',
        gap: '20px',
        padding: '20px',
      }}>
        {/* Left Panel - Metrics */}
        <div style={{
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(0, 255, 255, 0.2)',
          borderRadius: '10px',
          padding: '20px',
          background: 'rgba(0, 20, 40, 0.3)',
        }}>
          <MetricsPanel metrics={metrics} />

          {/* Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <button
              onClick={toggleMicrophone}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px',
                background: isMicEnabled ? 'rgba(0, 100, 200, 0.6)' : 'rgba(0, 30, 60, 0.6)',
                border: `1px solid ${isMicEnabled ? '#00ff00' : 'rgba(0, 255, 255, 0.3)'}`,
                borderRadius: '8px',
                color: isMicEnabled ? '#00ff00' : '#00ffff',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
            >
              <div>🎤</div>
              <div>{isMicEnabled ? 'MIC ON' : 'MIC OFF'}</div>
            </button>

            <button
              onClick={handleLeaveCall}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px',
                background: 'rgba(0, 30, 60, 0.6)',
                border: '1px solid #ff4444',
                borderRadius: '8px',
                color: '#ff4444',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
            >
              <div>⏻</div>
              <div>DISCONNECT</div>
            </button>
          </div>
        </div>

        {/* Center - Avatar */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}>
          <div style={{
            position: 'relative',
            width: '400px',
            height: '400px',
            border: '2px solid rgba(0, 255, 255, 0.8)',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0, 255, 255, 0.05) 0%, transparent 70%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'avatarGlow 3s ease-in-out infinite',
            overflow: 'hidden',
          }}>
            {remoteParticipantIds.length > 0 ? (
              <TransparentAvatar id={remoteParticipantIds[0]} />
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
              }}>
                <div style={{
                  width: '100px',
                  height: '100px',
                  border: '2px solid #00ffff',
                  borderRadius: '50%',
                  animation: 'pulseRing 2s infinite',
                }} />
                <div style={{
                  marginTop: '20px',
                  fontSize: '0.8rem',
                  color: 'rgba(0, 255, 255, 0.8)',
                  letterSpacing: '2px',
                }}>
                  INITIALIZING AVATAR
                </div>
              </div>
            )}
          </div>

          {/* Neural Activity Visualization */}
          <div style={{
            position: 'absolute',
            bottom: '-50px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '200px',
            height: '30px',
          }}>
            <div style={{
              width: '100%',
              height: '2px',
              background: 'linear-gradient(90deg, transparent, #00ffff, transparent)',
              animation: 'neuralWave 3s ease-in-out infinite',
            }} />
          </div>
        </div>

        {/* Right Panel - Timeline */}
        <div style={{
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(0, 255, 255, 0.2)',
          borderRadius: '10px',
          padding: '20px',
          background: 'rgba(0, 20, 40, 0.3)',
        }}>
          <ConversationTimeline messages={messages} />
        </div>
      </div>

      {/* Audio Component */}
      <DailyAudio />

      {/* CSS Animations */}
      <style>{`
        @keyframes gridShift {
          0% { transform: translate(0, 0); }
          100% { transform: translate(50px, 50px); }
        }

        @keyframes particleFloat {
          0%, 100% { transform: scale(1) rotate(0deg); }
          50% { transform: scale(1.1) rotate(180deg); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        @keyframes avatarGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(0, 255, 255, 0.3); }
          50% { box-shadow: 0 0 40px rgba(0, 255, 255, 0.6); }
        }

        @keyframes pulseRing {
          0% { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }

        @keyframes neuralWave {
          0%, 100% { transform: scaleX(0.5); opacity: 0.5; }
          50% { transform: scaleX(1.5); opacity: 1; }
        }

        @keyframes hologramScan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
      `}</style>
    </div>
  );
};

export default FuturisticAuroraInterface;