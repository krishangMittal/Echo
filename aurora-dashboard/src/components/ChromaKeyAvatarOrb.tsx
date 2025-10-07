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

interface ChromaKeyAvatarOrbProps {
  src: string;
  className?: string;
  style?: React.CSSProperties;
  size?: number;
  orbColor?: string;
  showOrb?: boolean;
}

export const ChromaKeyAvatarOrb: React.FC<ChromaKeyAvatarOrbProps> = ({ 
  src, 
  className = "", 
  style = {},
  size = 300,
  orbColor = "from-cyan-400 via-blue-500 to-purple-600",
  showOrb = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const glRef = useRef<WebGLRenderingContext | null>(null);

  // Handle SSR/hydration
  useEffect(() => {
    setMounted(true);
  }, []);

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
        // Set canvas to square dimensions for perfect circle
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

  // Don't render WebGL content until mounted
  if (!mounted) {
    return (
      <div 
        className={`relative flex items-center justify-center ${className}`} 
        style={{ width: size + 40, height: size + 40, ...style }}
      >
        <div className="flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`relative flex items-center justify-center ${className}`} 
      style={{ width: size + 40, height: size + 40, ...style }}
      suppressHydrationWarning
    >
      {/* Hidden video element */}
      <video
        ref={videoRef}
        src={src}
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
            className={`absolute inset-0 rounded-full bg-gradient-to-r ${orbColor} opacity-20`}
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.2, 0.4, 0.2]
            }}
            transition={{
              duration: 3,
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
            className={`absolute inset-0 rounded-full bg-gradient-to-r ${orbColor} opacity-30 border-2 border-white/10`}
            animate={{
              rotate: 360
            }}
            transition={{
              duration: 8,
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
            className={`absolute rounded-full bg-gradient-to-br ${orbColor} p-2 backdrop-blur-xl border border-white/20 shadow-2xl overflow-hidden`}
            animate={{
              boxShadow: [
                "0 0 40px rgba(59, 130, 246, 0.3)",
                "0 0 80px rgba(59, 130, 246, 0.5)",
                "0 0 40px rgba(59, 130, 246, 0.3)"
              ]
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
            {/* Inner container with black background */}
            <div className="w-full h-full rounded-full bg-black/80 backdrop-blur-md relative overflow-hidden">
              
              {/* Chroma key canvas */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full rounded-full"
                style={{
                  objectFit: "cover",
                  zIndex: 2,
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
              {!isVideoReady && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
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
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}

      {/* Simple version without orb (just the chroma key video) */}
      {!showOrb && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full rounded-full"
          style={{
            objectFit: "cover",
            ...style
          }}
        />
      )}
    </div>
  );
};
