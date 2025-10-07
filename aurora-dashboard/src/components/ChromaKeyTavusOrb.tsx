"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion } from 'framer-motion';

/**
 * WebGL Shader Programs for Chroma Key Effect
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

const initShader = (
  gl: WebGLRenderingContext,
  type: number,
  source: string,
) => {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
};

const initWebGL = (gl: WebGLRenderingContext) => {
  const program = gl.createProgram()!;
  gl.attachShader(
    program,
    initShader(gl, gl.VERTEX_SHADER, vertexShaderSource),
  );
  gl.attachShader(
    program,
    initShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource),
  );
  gl.linkProgram(program);
  gl.useProgram(program);

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

interface ChromaKeyTavusOrbProps {
  // Tavus/Daily integration
  conversationUrl?: string;
  dailyFrame?: any;
  autoCreateConversation?: boolean; // New prop to auto-create conversations
  
  // Orb styling
  size?: number;
  orbColor?: string;
  showOrb?: boolean;
  
  // Metrics for dynamic styling
  metrics?: {
    current_emotion: string;
    conversation_active: boolean;
  };
  
  className?: string;
  style?: React.CSSProperties;
}

export const ChromaKeyTavusOrb: React.FC<ChromaKeyTavusOrbProps> = ({ 
  conversationUrl,
  dailyFrame,
  autoCreateConversation = false,
  size = 320,
  orbColor,
  showOrb = true,
  metrics,
  className = "", 
  style = {}
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [dailyConnected, setDailyConnected] = useState(false);
  const [currentConversationUrl, setCurrentConversationUrl] = useState<string>(conversationUrl || "");
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const glRef = useRef<WebGLRenderingContext | null>(null);

  // Dynamic orb color based on emotion
  const getEmotionColor = (emotion: string) => {
    const colors = {
      excited: 'from-yellow-400 via-orange-400 to-red-400',
      happy: 'from-green-400 via-emerald-400 to-cyan-400',
      anxious: 'from-red-400 via-orange-400 to-yellow-400',
      sad: 'from-blue-400 via-indigo-400 to-purple-400',
      curious: 'from-purple-400 via-pink-400 to-cyan-400',
      neutral: 'from-gray-400 via-gray-500 to-gray-600',
    };
    return colors[emotion as keyof typeof colors] || colors.neutral;
  };

  const finalOrbColor = orbColor || (metrics ? getEmotionColor(metrics.current_emotion) : 'from-cyan-400 via-blue-500 to-purple-600');

  const createNewConversation = async () => {
    setIsCreatingConversation(true);
    try {
      const response = await fetch('http://localhost:8000/api/create-conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      setCurrentConversationUrl(result.conversation_url);
      console.log('New conversation created:', result);
      return result.conversation_url;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      throw error;
    } finally {
      setIsCreatingConversation(false);
    }
  };

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

  // Initialize Daily/Tavus integration
  useEffect(() => {
    if (dailyFrame) {
      setDailyConnected(true);
      return;
    }

    let frame: any = null;

    const initializeDaily = async () => {
      try {
        let urlToUse = currentConversationUrl;
        
        // If no conversation URL and auto-create is enabled, create a new one
        if (!urlToUse && autoCreateConversation) {
          urlToUse = await createNewConversation();
        }
        
        // Fallback to default if still no URL
        if (!urlToUse) {
          urlToUse = "https://tavus.daily.co/cfc548d2c897a4bb";
        }

        const Daily = (await import('@daily-co/daily-js')).default;
        
        if (containerRef.current) {
          frame = Daily.createFrame(containerRef.current, {
            iframeStyle: {
              width: '100%',
              height: '100%',
              border: 'none',
              borderRadius: '50%',
              overflow: 'hidden'
            },
            showLeaveButton: false,
            showFullscreenButton: false,
            showLocalVideo: false,
            showParticipantsBar: false,
          });

          frame.on('joined-meeting', () => {
            console.log('Joined Tavus conversation:', urlToUse);
            setDailyConnected(true);
            setIsVideoReady(true);
          });

          frame.on('error', (error: any) => {
            console.error('Daily error:', error);
            setDailyConnected(false);
            setIsVideoReady(false);
          });

          await frame.join({ url: urlToUse });
        }
      } catch (error) {
        console.error('Failed to initialize Daily:', error);
        setDailyConnected(false);
        setIsVideoReady(false);
      }
    };

    if (typeof window !== 'undefined' && currentConversationUrl) {
      initializeDaily();
    }

    return () => {
      if (frame) {
        try {
          frame.destroy();
        } catch (error) {
          console.warn('Error destroying Daily frame:', error);
        }
      }
    };
  }, [currentConversationUrl, dailyFrame, autoCreateConversation]);

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

    const applyChromaKey = (currentTime: number) => {
      if (currentTime - lastFrameTime < frameInterval) {
        animationFrameId = requestAnimationFrame(applyChromaKey);
        return;
      }

      lastFrameTime = currentTime;

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = size;
        canvas.height = size;
        gl.viewport(0, 0, size, size);

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          video,
        );

        gl.uniform1i(imageLocation, 0);
        gl.uniform3f(keyColorLocation, 3 / 255, 255 / 255, 156 / 255); // Green screen color
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
  }, [isVideoReady, webGLContext, size]);

  return (
    <div 
      className={`relative flex items-center justify-center ${className}`} 
      style={{ width: size + 40, height: size + 40, ...style }}
    >
      {/* Hidden video element for chroma key processing */}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        style={{ display: "none" }}
      />

      {showOrb && (
        <>
          {/* Outer glow ring */}
          <motion.div
            className={`absolute inset-0 rounded-full bg-gradient-to-r ${finalOrbColor} opacity-20`}
            animate={{
              scale: [1, 1.1, 1],
              opacity: metrics?.conversation_active ? [0.2, 0.4, 0.2] : [0.1, 0.2, 0.1]
            }}
            transition={{
              duration: metrics?.conversation_active ? 2 : 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            style={{
              width: size + 40,
              height: size + 40,
            }}
          />

          {/* Middle rotating ring */}
          <motion.div
            className={`absolute inset-0 rounded-full bg-gradient-to-r ${finalOrbColor} opacity-30 border-2 border-white/10`}
            animate={{
              rotate: 360
            }}
            transition={{
              duration: metrics?.conversation_active ? 6 : 12,
              repeat: Infinity,
              ease: "linear"
            }}
            style={{
              width: size + 20,
              height: size + 20,
              left: 10,
              top: 10
            }}
          />

          {/* Main orb container */}
          <motion.div
            className={`absolute rounded-full bg-gradient-to-br ${finalOrbColor} p-2 backdrop-blur-xl border border-white/20 shadow-2xl overflow-hidden`}
            animate={{
              boxShadow: dailyConnected
                ? [
                    "0 0 40px rgba(59, 130, 246, 0.3)",
                    "0 0 80px rgba(59, 130, 246, 0.5)",
                    "0 0 40px rgba(59, 130, 246, 0.3)"
                  ]
                : "0 0 20px rgba(75, 85, 99, 0.3)"
            }}
            transition={{
              boxShadow: { duration: 2, repeat: Infinity }
            }}
            style={{
              width: size,
              height: size,
              left: 20,
              top: 20
            }}
          >
            {/* Inner container */}
            <div className="w-full h-full rounded-full bg-black/80 backdrop-blur-md relative overflow-hidden">
              
              {/* Daily/Tavus iframe container */}
              <div
                ref={containerRef}
                className="absolute inset-0 w-full h-full rounded-full"
                style={{
                  transform: 'scale(1.1)',
                  transformOrigin: 'center center',
                }}
              />

              {/* Chroma key canvas overlay */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full rounded-full"
                style={{
                  objectFit: "cover",
                  zIndex: 2,
                  display: isVideoReady ? 'block' : 'none'
                }}
              />

              {/* Inner glow effect */}
              <div
                className="absolute inset-2 rounded-full"
                style={{
                  background: `radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.1), transparent 70%)`,
                  zIndex: 1,
                }}
              />

              {/* Loading state */}
              {(!isVideoReady || isCreatingConversation) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                  <motion.div
                    animate={{
                      scale: [1, 1.2, 1],
                      rotate: 360
                    }}
                    transition={{
                      scale: { duration: 1.5, repeat: Infinity },
                      rotate: { duration: 2, repeat: Infinity }
                    }}
                    className="text-cyan-400"
                  >
                    <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full" />
                  </motion.div>
                  {isCreatingConversation && (
                    <div className="mt-2 text-xs text-cyan-400 text-center">
                      Creating new conversation...
                    </div>
                  )}
                </div>
              )}

              {/* Status indicators */}
              {isVideoReady && (
                <>
                  {/* Activity indicator */}
                  {metrics?.conversation_active && (
                    <motion.div
                      className="absolute top-4 right-4 z-10"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <div className="flex space-x-1">
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            className="w-2 h-2 bg-green-400 rounded-full"
                            animate={{
                              scale: [1, 1.5, 1],
                              opacity: [0.5, 1, 0.5]
                            }}
                            transition={{
                              duration: 1,
                              delay: i * 0.2,
                              repeat: Infinity
                            }}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Emotion indicator */}
                  {metrics && (
                    <motion.div
                      className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10"
                      animate={{ opacity: dailyConnected ? 1 : 0.5 }}
                    >
                      <div className="text-xs text-cyan-400/70 bg-black/60 rounded px-2 py-1">
                        {metrics.current_emotion.toUpperCase()}
                      </div>
                    </motion.div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}

      {/* Simple version without orb */}
      {!showOrb && (
        <>
          <div
            ref={containerRef}
            className="absolute inset-0 w-full h-full rounded-full"
            style={{
              transform: 'scale(1.1)',
              transformOrigin: 'center center',
            }}
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full rounded-full"
            style={{
              objectFit: "cover",
              zIndex: 2,
              display: isVideoReady ? 'block' : 'none',
              ...style
            }}
          />
        </>
      )}
    </div>
  );
};
