"use client";

import { useEffect, useRef, useState } from 'react';

interface ConversationProps {
  conversationUrl: string;
  onLeave?: () => void;
}

export function Conversation({ conversationUrl, onLeave }: ConversationProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      setIsLoading(false);
    };

    const handleError = () => {
      setError('Failed to load conversation');
      setIsLoading(false);
    };

    iframe.addEventListener('load', handleLoad);
    iframe.addEventListener('error', handleError);

    return () => {
      iframe.removeEventListener('load', handleLoad);
      iframe.removeEventListener('error', handleError);
    };
  }, []);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black/80 rounded-full">
        <div className="text-center text-red-400">
          <div className="text-sm">Connection Error</div>
          <div className="text-xs mt-1">Failed to load Aurora</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-full">
          <div className="text-center text-cyan-400">
            <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <div className="text-xs">Connecting to Aurora...</div>
          </div>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={conversationUrl}
        className="w-full h-full border-0 rounded-full"
        allow="camera; microphone; autoplay"
        style={{
          background: 'transparent',
          isolation: 'isolate'
        }}
      />
    </div>
  );
}
