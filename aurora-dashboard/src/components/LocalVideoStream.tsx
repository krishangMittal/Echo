"use client";

import { useLocalSessionId } from "@daily-co/daily-react";
import { DailyVideo } from "@daily-co/daily-react";

interface LocalVideoStreamProps {
  className?: string;
}

export const LocalVideoStream: React.FC<LocalVideoStreamProps> = ({
  className = ""
}) => {
  const localSessionId = useLocalSessionId();

  if (!localSessionId) {
    return (
      <div className={`flex items-center justify-center bg-gray-900/50 ${className}`}>
        <div className="text-gray-500 text-sm font-light">
          Camera not connected
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <DailyVideo
        sessionId={localSessionId}
        type="video"
        className="w-full h-full object-cover rounded-lg"
      />

      {/* Overlay indicator */}
      <div className="absolute bottom-2 right-2 flex space-x-1">
        <div className="w-6 h-6 bg-black/60 rounded border border-gray-600/50 flex items-center justify-center">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
        </div>
      </div>
    </div>
  );
};