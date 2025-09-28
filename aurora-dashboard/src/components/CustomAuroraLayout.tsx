"use client";

import { motion } from 'framer-motion';
import { Brain, Zap, Heart, Database, Settings } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { CVIProvider } from './cvi/components/cvi-provider';
import { Conversation } from './cvi/components/conversation';
import { MicSelectBtn, CameraSelectBtn } from './cvi/components/device-select';
import { TransparentAvatarVideo } from './TransparentAvatarVideo';
import './aurora-conversation.css';

interface CustomAuroraLayoutProps {
  metrics: {
    relationship_level: number;
    trust_level: number;
    emotional_sync: number;
    memory_depth: number;
    current_emotion: string;
    current_topic: string;
    conversation_active: boolean;
  };
  connected: boolean;
  userId?: string;
  conversationUrl?: string | null;
  onSpeechProcessed?: (result: any) => void;
}

export function CustomAuroraLayout({ metrics, connected, userId = 'default_user', conversationUrl, onSpeechProcessed }: CustomAuroraLayoutProps) {
  const [mounted, setMounted] = useState(false);
  const [conversationEnded, setConversationEnded] = useState(false);
  const [isJoiningCall, setIsJoiningCall] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-join call when conversation URL is provided
  useEffect(() => {
    if (conversationUrl && !isJoiningCall) {
      setIsJoiningCall(true);
      console.log('🔗 Joining Tavus conversation:', conversationUrl);

      // The CVIProvider should handle the Daily.co connection
      // We just need to trigger the join with the conversation URL
    }
  }, [conversationUrl, isJoiningCall]);

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

  const getAvatarSize = () => {
    const baseSize = 320;
    const activityBonus = metrics.conversation_active ? 40 : 0;
    const emotionBonus = metrics.current_emotion !== 'neutral' ? 20 : 0;
    return baseSize + activityBonus + emotionBonus;
  };

  const getOrbitingMetrics = () => [
    {
      label: 'REL',
      value: metrics.relationship_level,
      icon: Heart,
      color: 'text-pink-400',
      position: { angle: 0, radius: 200 }
    },
    {
      label: 'TRS',
      value: metrics.trust_level,
      icon: Database,
      color: 'text-blue-400',
      position: { angle: 90, radius: 200 }
    },
    {
      label: 'EMO',
      value: metrics.emotional_sync,
      icon: Zap,
      color: 'text-yellow-400',
      position: { angle: 180, radius: 200 }
    },
    {
      label: 'MEM',
      value: metrics.memory_depth,
      icon: Brain,
      color: 'text-purple-400',
      position: { angle: 270, radius: 200 }
    }
  ];

  const avatarSize = getAvatarSize();
  const orbitingMetrics = getOrbitingMetrics();

  const handleConversationLeave = () => {
    console.log('🚪 Conversation ended');
    setConversationEnded(true);
  };

  if (!mounted) {
    return (
      <div className="relative flex items-center justify-center">
        <div className="w-80 h-80 rounded-full bg-black/80 flex items-center justify-center">
          <div className="text-cyan-400 font-mono">LOADING AURORA...</div>
        </div>
      </div>
    );
  }

  return (
    <CVIProvider>
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Large Transparent Avatar - No Orb, Just Pure Avatar */}
        <TransparentAvatarVideo
          conversationUrl={conversationUrl}
          className="w-full h-full"
          onLeave={handleConversationLeave}
        />


        {/* Conversation ended overlay */}
        {conversationEnded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center"
          >
            <div className="bg-black/80 border border-gray-700/50 rounded-xl p-6 text-center">
              <div className="text-xl text-white mb-2">Neural Session Ended</div>
              <div className="text-gray-400 text-sm">Aurora connection terminated</div>
              <button
                onClick={() => setConversationEnded(false)}
                className="mt-4 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all"
              >
                Reconnect
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </CVIProvider>
  );
}