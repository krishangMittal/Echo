"use client";

import { Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { useState, useEffect } from 'react';

export function MicSelectBtn() {
  const [isMuted, setIsMuted] = useState(false);

  const handleToggle = async () => {
    try {
      // Get user media stream and toggle audio
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        console.log('Mic toggled:', audioTrack.enabled);
      }
    } catch (error) {
      console.error('Error toggling mic:', error);
    }
  };

  return (
    <button
      onClick={handleToggle}
      className={`w-full h-full flex items-center justify-center transition-all ${
        isMuted ? 'text-red-400' : 'text-green-400'
      }`}
      title={isMuted ? 'Unmute' : 'Mute'}
    >
      {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
    </button>
  );
}

export function CameraSelectBtn() {
  const [isOff, setIsOff] = useState(false);

  const handleToggle = async () => {
    try {
      // Get user media stream and toggle video
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsOff(!videoTrack.enabled);
        console.log('Camera toggled:', videoTrack.enabled);
      }
    } catch (error) {
      console.error('Error toggling camera:', error);
    }
  };

  return (
    <button
      onClick={handleToggle}
      className={`w-full h-full flex items-center justify-center transition-all ${
        isOff ? 'text-red-400' : 'text-blue-400'
      }`}
      title={isOff ? 'Turn on camera' : 'Turn off camera'}
    >
      {isOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
    </button>
  );
}
