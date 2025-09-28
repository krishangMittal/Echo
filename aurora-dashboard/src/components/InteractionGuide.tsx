"use client";

import { motion } from 'framer-motion';
import { Mic, MessageCircle, Brain, Zap } from 'lucide-react';
import { useState, useEffect } from 'react';

export function InteractionGuide() {
  const [userName, setUserName] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedName = localStorage.getItem('aurora_user_name') || '';
    setUserName(savedName);
  }, []);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-black/30 backdrop-blur-md border border-gray-700/50 rounded-xl p-6 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center space-x-3">
        <div className="p-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 bg-opacity-20">
          <MessageCircle className="w-5 h-5 text-green-400" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-white">Talk to Aurora</h3>
          <p className="text-sm text-gray-400">Neural conversation interface</p>
        </div>
      </div>

      {/* Instructions */}
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 flex items-center justify-center">
              <Mic className="w-4 h-4 text-white" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-200">Voice Interaction</h4>
              <p className="text-xs text-gray-400 mt-1">
                Simply speak to Aurora in the center orb. Your voice will be captured automatically.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-purple-400 to-pink-500 flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-200">Real-time Analysis</h4>
              <p className="text-xs text-gray-400 mt-1">
                Aurora analyzes your speech patterns, emotions, and topics in real-time.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-200">Dynamic Metrics</h4>
              <p className="text-xs text-gray-400 mt-1">
                Watch the orbiting metrics update based on your conversation depth and emotional connection.
              </p>
            </div>
          </div>
        </div>

        {/* Current status */}
        <div className="border-t border-gray-700/50 pt-4 space-y-2">
          <h4 className="text-sm font-medium text-gray-300">Current Status</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Voice Recognition</span>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-xs text-green-400">Active</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Neural Processing</span>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                <span className="text-xs text-cyan-400">Ready</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Avatar Connection</span>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                <span className="text-xs text-blue-400">Connected</span>
              </div>
            </div>
          </div>
        </div>

        {/* User customization */}
        <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg p-3 border border-purple-500/20 space-y-3">
          <h4 className="text-xs font-medium text-purple-400 mb-2">👤 User Settings</h4>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Your Name</label>
            <input
              type="text"
              placeholder="Enter your name..."
              className="w-full bg-black/40 border border-gray-600/30 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:border-purple-400 focus:outline-none"
              value={userName}
              onChange={(e) => {
                setUserName(e.target.value);
                if (mounted) {
                  localStorage.setItem('aurora_user_name', e.target.value);
                }
              }}
            />
          </div>

          <button
            onClick={async () => {
              try {
                const response = await fetch('http://localhost:8000/api/create-conversation', {
                  method: 'POST'
                });
                const data = await response.json();
                alert(`New conversation created!\nURL: ${data.conversation_url}\nID: ${data.conversation_id}`);
              } catch (error) {
                alert('Failed to create conversation');
              }
            }}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs py-2 rounded font-medium hover:shadow-lg hover:shadow-purple-500/30 transition-all"
          >
            Create New Conversation
          </button>
        </div>

        {/* Quick tips */}
        <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-lg p-3 border border-cyan-500/20">
          <h4 className="text-xs font-medium text-cyan-400 mb-2">💡 Quick Tips</h4>
          <ul className="text-xs text-gray-300 space-y-1">
            <li>• Speak naturally - Aurora understands conversational language</li>
            <li>• Share your thoughts, feelings, or ask questions</li>
            <li>• Watch the avatar's emotional responses in real-time</li>
            <li>• Check the Analytics tab for deeper insights</li>
          </ul>
        </div>
      </div>
    </motion.div>
  );
}