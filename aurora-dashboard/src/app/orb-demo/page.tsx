"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChromaKeyAvatarOrb } from '@/components/ChromaKeyAvatarOrb';
import { ArrowLeft, Settings, Palette, Eye, EyeOff, RefreshCw, Zap } from 'lucide-react';
import Link from 'next/link';

export default function OrbDemo() {
  const [mounted, setMounted] = useState(false);
  const [size, setSize] = useState(300);
  const [orbColor, setOrbColor] = useState("from-cyan-400 via-blue-500 to-purple-600");
  const [showOrb, setShowOrb] = useState(true);
  const [videoSrc, setVideoSrc] = useState("/api/placeholder/300/300");
  const [conversationUrl, setConversationUrl] = useState<string>("");
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [conversationInfo, setConversationInfo] = useState<any>(null);
  const [activeVideoSource, setActiveVideoSource] = useState<'placeholder' | 'sample' | 'tavus'>('placeholder');

  const colorPresets = [
    { name: "Cyan Blue", value: "from-cyan-400 via-blue-500 to-purple-600" },
    { name: "Fire", value: "from-yellow-400 via-orange-500 to-red-500" },
    { name: "Ocean", value: "from-blue-400 via-cyan-400 to-teal-400" },
    { name: "Sunset", value: "from-pink-400 via-purple-500 to-indigo-500" },
    { name: "Forest", value: "from-green-400 via-emerald-500 to-teal-500" },
    { name: "Neon", value: "from-green-400 via-cyan-400 to-blue-400" },
    { name: "Royal", value: "from-purple-400 via-indigo-500 to-blue-500" },
    { name: "Warm", value: "from-orange-400 via-red-400 to-pink-400" },
  ];

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
      setConversationUrl(result.conversation_url);
      setVideoSrc(result.conversation_url);
      setConversationInfo(result);
      setActiveVideoSource('tavus');
      console.log('New conversation created:', result);
    } catch (error) {
      console.error('Failed to create conversation:', error);
      alert('Failed to create conversation. Please make sure your backend is running on localhost:8000');
    } finally {
      setIsCreatingConversation(false);
    }
  };

  // Handle SSR/hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render until mounted to avoid hydration mismatch
  if (!mounted) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 animate-spin" />
          <span className="text-cyan-400 font-mono">LOADING ORB DEMO...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative" suppressHydrationWarning>
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 flex justify-between items-center p-6 border-b border-gray-800/50 backdrop-blur-sm"
      >
        <div className="flex items-center space-x-4">
          <Link href="/">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Dashboard</span>
            </motion.button>
          </Link>
          <div>
            <h1 className="text-2xl font-light tracking-wide">Chroma Key Avatar Orb</h1>
            <p className="text-gray-400 text-sm">Interactive Demo & Customization</p>
          </div>
        </div>
      </motion.div>

      {/* Main content */}
      <div className="relative z-10 p-6 h-[calc(100vh-100px)]">
        <div className="flex h-full gap-6">
          {/* Demo area */}
          <div className="flex-1 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col items-center space-y-6"
            >
              {/* Main orb display */}
              <ChromaKeyAvatarOrb
                src={videoSrc}
                size={size}
                orbColor={orbColor}
                showOrb={showOrb}
                className="transition-all duration-500"
              />

               {/* Video source info */}
               <div className="text-center text-gray-400 text-sm">
                 <p>Video Source: {activeVideoSource === 'tavus' ? 'Live Tavus Avatar' : activeVideoSource}</p>
                 {activeVideoSource === 'tavus' ? (
                   <p className="text-xs mt-1 text-green-400">
                     ✅ Connected to Aurora - Real-time avatar with chroma key
                   </p>
                 ) : (
                   <p className="text-xs mt-1">
                     Note: This demo uses a {activeVideoSource} video. Click "Create Tavus Conversation" for live avatar.
                   </p>
                 )}
               </div>
            </motion.div>
          </div>

          {/* Controls panel */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="w-80 bg-black/30 backdrop-blur-md border border-gray-700/50 rounded-xl p-6 space-y-6"
          >
            <div className="flex items-center space-x-2">
              <Settings className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-medium">Controls</h2>
            </div>

            {/* Size control */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-300">Size</label>
              <div className="space-y-2">
                <input
                  type="range"
                  min="200"
                  max="500"
                  value={size}
                  onChange={(e) => setSize(Number(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>200px</span>
                  <span className="text-cyan-400 font-mono">{size}px</span>
                  <span>500px</span>
                </div>
              </div>
            </div>

            {/* Orb toggle */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-300">Orb Effects</label>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowOrb(!showOrb)}
                className={`w-full flex items-center justify-center space-x-2 py-3 rounded-lg border transition-all ${
                  showOrb
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                    : 'bg-gray-700/50 border-gray-600/50 text-gray-400'
                }`}
              >
                {showOrb ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                <span>{showOrb ? 'Orb Enabled' : 'Orb Disabled'}</span>
              </motion.button>
            </div>

            {/* Color presets */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-300">Color Theme</label>
              <div className="grid grid-cols-2 gap-2">
                {colorPresets.map((preset) => (
                  <motion.button
                    key={preset.name}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setOrbColor(preset.value)}
                    className={`p-2 rounded-lg border transition-all text-xs ${
                      orbColor === preset.value
                        ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                        : 'bg-gray-700/50 border-gray-600/50 text-gray-400 hover:border-gray-500/50'
                    }`}
                  >
                    <div className={`w-full h-4 rounded mb-1 bg-gradient-to-r ${preset.value}`} />
                    {preset.name}
                  </motion.button>
                ))}
              </div>
            </div>

             {/* Video source */}
             <div className="space-y-3">
               <label className="text-sm font-medium text-gray-300">Video Source</label>
               <div className="space-y-2">
                 <motion.button
                   whileHover={{ scale: 1.02 }}
                   whileTap={{ scale: 0.98 }}
                   onClick={createNewConversation}
                   disabled={isCreatingConversation}
                   className={`w-full flex items-center justify-center space-x-2 py-3 rounded-lg border text-sm transition-all ${
                     activeVideoSource === 'tavus'
                       ? 'bg-green-500/20 border-green-500/50 text-green-400'
                       : 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                   } ${isCreatingConversation ? 'opacity-50 cursor-not-allowed' : ''}`}
                 >
                   <RefreshCw className={`w-4 h-4 ${isCreatingConversation ? 'animate-spin' : ''}`} />
                   <span>
                     {isCreatingConversation 
                       ? 'Creating...' 
                       : activeVideoSource === 'tavus'
                         ? 'New Tavus Conversation' 
                         : 'Create Tavus Conversation'
                     }
                   </span>
                 </motion.button>
                 
                 <button
                   onClick={() => {
                     setVideoSrc("/api/placeholder/300/300");
                     setActiveVideoSource('placeholder');
                   }}
                   className={`w-full text-left p-2 rounded-lg border text-sm transition-all ${
                     activeVideoSource === 'placeholder'
                       ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                       : 'bg-gray-700/50 border-gray-600/50 text-gray-400 hover:border-gray-500/50'
                   }`}
                 >
                   Placeholder Video
                 </button>
                 
                 <button
                   onClick={() => {
                     setVideoSrc("https://sample-videos.com/zip/10/mp4/SampleVideo_360x240_1mb.mp4");
                     setActiveVideoSource('sample');
                   }}
                   className={`w-full text-left p-2 rounded-lg border text-sm transition-all ${
                     activeVideoSource === 'sample'
                       ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                       : 'bg-gray-700/50 border-gray-600/50 text-gray-400 hover:border-gray-500/50'
                   }`}
                 >
                   Sample Video
                 </button>
                 
                 <div className="text-xs text-gray-500 p-2 bg-gray-800/50 rounded">
                   💡 Tavus conversation automatically creates a new avatar session
                 </div>
                 
                 {conversationInfo && (
                   <div className="text-xs text-green-400 p-2 bg-green-900/20 rounded border border-green-500/20">
                     <div className="font-mono">ID: {conversationInfo.conversation_id}</div>
                     <div className="truncate">URL: {conversationInfo.conversation_url}</div>
                   </div>
                 )}
               </div>
             </div>

            {/* Code example */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-300">Usage Example</label>
              <div className="bg-gray-900/50 rounded-lg p-3 text-xs font-mono text-gray-300 overflow-x-auto">
                <pre>{`<ChromaKeyAvatarOrb
  src="${videoSrc}"
  size={${size}}
  orbColor="${orbColor}"
  showOrb={${showOrb}}
/>`}</pre>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* CSS for custom slider */}
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #06b6d4;
          cursor: pointer;
          border: 2px solid #000;
        }
        .slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #06b6d4;
          cursor: pointer;
          border: 2px solid #000;
        }
      `}</style>
    </div>
  );
}
