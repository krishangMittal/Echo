"use client";

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface TavusChromaKeyOrbProps {
  conversationUrl: string;
  className?: string;
  style?: React.CSSProperties;
}

export const TavusChromaKeyOrb: React.FC<TavusChromaKeyOrbProps> = ({ 
  conversationUrl, 
  className = "", 
  style = {} 
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    const canvas = canvasRef.current;
    
    if (!iframe || !canvas) return;

    let animationId: number;
    let gl: WebGLRenderingContext | null = null;
    let program: WebGLProgram | null = null;
    let texture: WebGLTexture | null = null;

    // WebGL shaders for chroma key effect
    const vertexShaderSource = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0, 1);
        v_texCoord = a_texCoord;
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

    const initWebGL = () => {
      gl = canvas.getContext('webgl', {
        premultipliedAlpha: false,
        alpha: true
      });

      if (!gl) return false;

      // Create shaders
      const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
      gl.shaderSource(vertexShader, vertexShaderSource);
      gl.compileShader(vertexShader);

      const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
      gl.shaderSource(fragmentShader, fragmentShaderSource);
      gl.compileShader(fragmentShader);

      // Create program
      program = gl.createProgram()!;
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      gl.useProgram(program);

      // Set up buffers
      const positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

      const texCoordBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);

      // Set up attributes
      const positionLocation = gl.getAttribLocation(program, 'a_position');
      const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');

      gl.enableVertexAttribArray(positionLocation);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      gl.enableVertexAttribArray(texCoordLocation);
      gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
      gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

      // Create texture
      texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      return true;
    };

    const renderFrame = () => {
      if (!gl || !program || !texture) return;

      // Set canvas size
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);

      // Try to capture video from iframe (this is a simplified approach)
      // In a real implementation, you'd need to access the video stream from the iframe
      // For now, we'll create a simple chroma key effect on the iframe itself
      
      // Set uniforms
      const imageLocation = gl.getUniformLocation(program, 'u_image');
      const keyColorLocation = gl.getUniformLocation(program, 'u_keyColor');
      const thresholdLocation = gl.getUniformLocation(program, 'u_threshold');

      gl.uniform1i(imageLocation, 0);
      gl.uniform3f(keyColorLocation, 0.0, 1.0, 0.0); // Green key color
      gl.uniform1f(thresholdLocation, 0.3);

      // Draw
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      animationId = requestAnimationFrame(renderFrame);
    };

    // Initialize WebGL
    if (initWebGL()) {
      setIsConnected(true);
      renderFrame();
    } else {
      setError('WebGL not supported');
    }

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      if (gl && program) {
        gl.deleteProgram(program);
      }
      if (gl && texture) {
        gl.deleteTexture(texture);
      }
    };
  }, [conversationUrl]);

  return (
    <div className={`relative ${className}`} style={style}>
      {/* Tavus iframe */}
      <iframe
        ref={iframeRef}
        src={conversationUrl}
        className="absolute inset-0 w-full h-full border-none"
        style={{
          background: 'transparent',
          zIndex: 2,
          borderRadius: '50%'
        }}
        allow="camera; microphone; autoplay"
        onLoad={() => {
          console.log('✅ Tavus iframe loaded:', conversationUrl);
          setIsConnected(true);
        }}
        onError={() => {
          console.error('❌ Tavus iframe failed to load:', conversationUrl);
          setError('Failed to load Tavus conversation');
        }}
      />
      
      {/* WebGL canvas for chroma key effect - temporarily disabled for debugging */}
      {/* <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full rounded-full"
        style={{
          background: 'transparent',
          zIndex: 2,
          mixBlendMode: 'multiply'
        }}
      /> */}
      
      {/* Loading state */}
      {!isConnected && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-full">
          <div className="text-cyan-400 text-sm font-mono">CONNECTING TO AURORA...</div>
          <div className="text-gray-400 text-xs font-mono mt-2">URL: {conversationUrl}</div>
          <div className="text-yellow-400 text-xs font-mono mt-2">Check browser console for details</div>
        </div>
      )}
      
      {/* Debug: Show iframe info */}
      {isConnected && (
        <div className="absolute top-2 left-2 z-10 bg-black/80 text-white text-xs p-2 rounded">
          <div>✅ Iframe Loaded</div>
          <div>URL: {conversationUrl.substring(0, 30)}...</div>
        </div>
      )}
      
      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-900/60 rounded-full">
          <div className="text-red-400 text-sm font-mono">{error}</div>
        </div>
      )}
      
      {/* Connection status indicator */}
      {isConnected && !error && (
        <div className="absolute top-2 right-2 z-10">
          <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" title="Connected to Aurora" />
        </div>
      )}
    </div>
  );
};
