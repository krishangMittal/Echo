"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  useDaily,
  DailyVideo,
  useParticipantIds,
  useLocalSessionId,
  useAudioTrack,
  DailyAudio,
} from "@daily-co/daily-react";

/**
 * WebGL Shader Programs for Chroma Key Effect
 *
 * The vertex shader transforms vertex positions and maps texture coordinates.
 */
const vertexShaderSource = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0, 1);
    v_texCoord = vec2(a_texCoord.x, 1.0 - a_texCoord.y);
  }
`;

/**
 * Fragment shader that implements the chroma key (green screen) effect.
 * Removes pixels matching the key color within a certain threshold.
 */
const fragmentShaderSource = `
  precision mediump float;
  uniform sampler2D u_image;
  varying vec2 v_texCoord;
  uniform vec3 u_keyColor;
  uniform float u_threshold;
  void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    
    // Multiple methods to detect green screen
    float diff1 = length(color.rgb - u_keyColor);
    float diff2 = abs(color.g - u_keyColor.g); // Green channel difference
    float diff3 = length(color.rgb - vec3(0.0, 1.0, 0.0)); // Pure green difference
    
    // Use the minimum difference and be more aggressive
    float minDiff = min(min(diff1, diff2), diff3);
    
    // More aggressive threshold - remove anything that's close to green
    if (minDiff < u_threshold || color.g > 0.7) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0); // Transparent
    } else {
      gl_FragColor = color;
    }
  }
`;

/**
 * Helper function to create and compile a WebGL shader
 */
const initShader = (
  gl: WebGLRenderingContext,
  type: number,
  source: string,
) => {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  // Check for compilation errors
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(shader);
    console.error(`Shader compilation failed:`, error);
    console.error('Shader source:', source);
    gl.deleteShader(shader);
    return null;
  }

  return shader;
};

/**
 * Initializes the WebGL context with necessary buffers and shaders
 */
const initWebGL = (gl: WebGLRenderingContext) => {
  const program = gl.createProgram()!;
  
  // Create and attach shaders
  const vertexShader = initShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = initShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  
  if (!vertexShader || !fragmentShader) {
    console.error('Failed to compile shaders');
    gl.deleteProgram(program);
    return null;
  }
  
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  
  // Check for linking errors
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const error = gl.getProgramInfoLog(program);
    console.error('WebGL program linking failed:', error);
    gl.deleteProgram(program);
    return null;
  }
  
  gl.useProgram(program);

  // Set up buffers
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );

  const texCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
    gl.STATIC_DRAW,
  );

  // Get attribute locations
  const positionLocation = gl.getAttribLocation(program, "a_position");
  const texCoordLocation = gl.getAttribLocation(program, "a_texCoord");

  // Set up attributes
  gl.enableVertexAttribArray(positionLocation);
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  gl.enableVertexAttribArray(texCoordLocation);
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

  // Create and configure texture
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  // Get uniform locations
  const imageLocation = gl.getUniformLocation(program, "u_image");
  const keyColorLocation = gl.getUniformLocation(program, "u_keyColor");
  const thresholdLocation = gl.getUniformLocation(program, "u_threshold");

  // Validate uniform locations
  if (!imageLocation || !keyColorLocation || !thresholdLocation) {
    console.error('Failed to get uniform locations:', {
      imageLocation,
      keyColorLocation,
      thresholdLocation
    });
    gl.deleteProgram(program);
    gl.deleteTexture(texture);
    return null;
  }

  console.log('✅ WebGL initialized successfully with uniforms:', {
    imageLocation,
    keyColorLocation,
    thresholdLocation
  });

  return {
    program,
    texture,
    imageLocation,
    keyColorLocation,
    thresholdLocation,
  };
};

/**
 * Transparent video component with chroma key effect
 */
interface TransparentVideoProps {
  id: string;
  className?: string;
  style?: React.CSSProperties;
}

export const TransparentVideo: React.FC<TransparentVideoProps> = ({
  id,
  className = "",
  style = {}
}) => {
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
    if (!isVideoReady || !webGLContext) {
      console.log('⏳ Waiting for video or WebGL context:', { isVideoReady, webGLContext: !!webGLContext });
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const gl = glRef.current;
    if (!video || !canvas || !gl) {
      console.log('⏳ Missing video, canvas, or GL context:', { video: !!video, canvas: !!canvas, gl: !!gl });
      return;
    }

    const {
      program,
      texture,
      imageLocation,
      keyColorLocation,
      thresholdLocation,
    } = webGLContext;

    let animationFrameId: number;
    let lastFrameTime = 0;
    const targetFPS = 30;
    const frameInterval = 1000 / targetFPS;

    console.log('🎬 Starting chroma key processing for video:', video.videoWidth, 'x', video.videoHeight);

    const applyChromaKey = (currentTime: number) => {
      if (currentTime - lastFrameTime < frameInterval) {
        animationFrameId = requestAnimationFrame(applyChromaKey);
        return;
      }

      lastFrameTime = currentTime;

      if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0 && video.videoHeight > 0) {
        // Ensure canvas matches video dimensions
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          console.log('📐 Canvas resized to:', canvas.width, 'x', canvas.height);
        }
        
        gl.viewport(0, 0, canvas.width, canvas.height);

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          video,
        );

        // Configure chroma key parameters for better green screen removal
        gl.uniform1i(imageLocation, 0);
        // Try different green screen colors - Tavus might use a specific green
        gl.uniform3f(keyColorLocation, 3 / 255, 255 / 255, 156 / 255); // Original Tavus green
        gl.uniform1f(thresholdLocation, 0.6); // Higher threshold to catch more green variations

        // Debug: Log every 30 frames to see what's happening
        if (Math.floor(currentTime / 1000) % 2 === 0 && Math.floor(currentTime / 100) % 10 === 0) {
          console.log('🎨 Chroma key active - removing green screen with threshold:', 0.6);
        }

        // Clear the canvas with transparent background
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

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
    <div className={`relative ${className}`} style={style}>
      <DailyVideo
        sessionId={id}
        type="video"
        ref={videoRef}
        style={{ display: "none" }}
      />
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain"
        style={{
          background: "transparent",
          display: "block",
        }}
      />
    </div>
  );
};

/**
 * Main transparent avatar component for Aurora
 */
interface TransparentAvatarVideoProps {
  conversationUrl?: string | null;
  className?: string;
  onLeave?: () => void;
}

export const TransparentAvatarVideo: React.FC<TransparentAvatarVideoProps> = ({
  conversationUrl,
  className = "",
  onLeave
}) => {
  const remoteParticipantIds = useParticipantIds({ filter: "remote" });
  const localParticipantId = useLocalSessionId();
  const localAudio = useAudioTrack(localParticipantId);
  const daily = useDaily();
  const [isJoining, setIsJoining] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [speechMessages, setSpeechMessages] = useState<string[]>([]);

  // Auto-join the call when conversation URL is provided
  useEffect(() => {
    console.log('🔍 TransparentAvatarVideo effect:', {
      conversationUrl,
      hasDaily: !!daily,
      isJoining,
      hasJoined
    });

    if (conversationUrl && daily && !isJoining && !hasJoined) {
      setIsJoining(true);
      console.log('🚀 Joining Tavus conversation:', conversationUrl);

      daily.join({ url: conversationUrl })
        .then(() => {
          console.log('✅ Successfully joined Tavus conversation');
          setHasJoined(true);
          
          // Set up speech processing event listeners
          setupSpeechProcessing();
        })
        .catch((error) => {
          console.error('❌ Failed to join Tavus conversation:', error);
          console.error('Error details:', error);
        })
        .finally(() => {
          setIsJoining(false);
        });
    }
  }, [conversationUrl, daily, isJoining, hasJoined]);

  const setupSpeechProcessing = () => {
    if (!daily) return;

    console.log('🎤 Setting up speech processing...');

    // Listen for app-message events exactly like aurora_client.html
    daily.on('app-message', (event: any) => {
      const data = event.data;
      console.log('📢 App message received:', data);

      if (data.event_type === 'conversation.utterance') {
        const speech = data.properties?.speech;
        const role = data.properties?.role;

        if (role === 'user' && speech) {
          console.log('🗣️ User speech detected:', speech);
          setSpeechMessages(prev => [...prev, `You said: ${speech}`]);

          // Send to backend for processing (exact same as aurora_client.html)
          fetch('http://localhost:8000/api/process-speech', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: speech })
          })
          .then(response => response.json())
          .then(result => {
            console.log('✅ Speech processed:', result);
            setSpeechMessages(prev => [...prev, 'Speech processed and analyzed!']);

            // Show analysis results (exact same as aurora_client.html)
            if (result.speech_record?.analysis) {
              const analysis = result.speech_record.analysis;
              const analysisText = `Analysis: ${analysis.topic} | ${analysis.emotion} | Importance: ${analysis.importance}/10`;
              setSpeechMessages(prev => [...prev, analysisText]);
            }
          })
          .catch(err => {
            console.error('❌ Error sending to backend:', err);
            setSpeechMessages(prev => [...prev, `Error: ${err.message}`]);
          });

        } else if (role === 'replica' && speech) {
          console.log('🤖 Aurora speech detected:', speech);
          setSpeechMessages(prev => [...prev, `Aurora said: ${speech}`]);
        }
      }
      else if (data.event_type === 'conversation.user.started_speaking') {
        console.log('🎤 User started speaking...');
        setSpeechMessages(prev => [...prev, 'You started speaking...']);
      }
      else if (data.event_type === 'conversation.replica.started_speaking') {
        console.log('🤖 Aurora is responding...');
        setSpeechMessages(prev => [...prev, 'Aurora is responding...']);
      }
    });

    // Connection events
    daily.on('joined-meeting', () => {
      console.log('✅ Connected to Aurora! Ready for speech...');
      setSpeechMessages(prev => [...prev, 'Connected to Aurora! Start speaking...']);
    });

    daily.on('participant-joined', (event: any) => {
      console.log('👤 Participant joined:', event);
    });

    daily.on('participant-left', (event: any) => {
      console.log('👋 Participant left:', event);
    });

    daily.on('error', (error: any) => {
      console.error('❌ Daily.co error:', error);
      setSpeechMessages(prev => [...prev, `Error: ${error}`]);
    });
  };

  const handleLeave = () => {
    daily?.leave();
    setHasJoined(false);
    onLeave?.();
  };

  return (
    <div className={`relative ${className}`}>
      {remoteParticipantIds.length > 0 ? (
        <TransparentVideo
          id={remoteParticipantIds[0]}
          className="w-full h-full"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-cyan-400 font-mono animate-pulse text-center space-y-2">
            {isJoining ? (
              <>
                <div>Connecting to Aurora...</div>
                <div className="text-sm text-gray-400">Initializing neural link</div>
              </>
            ) : conversationUrl ? (
              <>
                <div>Waiting for Aurora...</div>
                <div className="text-sm text-gray-400">Neural interface ready</div>
              </>
            ) : (
              <>
                <div>No conversation active</div>
                <div className="text-sm text-gray-400">Start a conversation to see Aurora</div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Speech Messages Overlay */}
      {speechMessages.length > 0 && (
        <div className="absolute bottom-4 left-4 right-4 max-h-32 overflow-y-auto">
          <div className="bg-black/80 backdrop-blur-md border border-cyan-500/30 rounded-lg p-3 space-y-1">
            {speechMessages.slice(-5).map((message, index) => (
              <div key={index} className="text-xs text-gray-300 font-mono">
                {message}
              </div>
            ))}
          </div>
        </div>
      )}

      <DailyAudio />
    </div>
  );
};