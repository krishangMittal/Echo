"use client";

import { motion } from 'framer-motion';
import { Brain, Zap, Heart, Database, Settings } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { CVIProvider } from './cvi/components/cvi-provider';
import { Conversation } from './cvi/components/conversation';
import { MicSelectBtn, CameraSelectBtn } from './cvi/components/device-select';
import { TavusChromaKeyOrb } from './TavusChromaKeyOrb';
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
  onSpeechProcessed?: (result: any) => void;
}

export function CustomAuroraLayout({ metrics, connected, userId = 'default_user', onSpeechProcessed }: CustomAuroraLayoutProps) {
  const [mounted, setMounted] = useState(false);
  const [conversationEnded, setConversationEnded] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
      <div className="relative w-full h-full">
        {/* Central Avatar Orb with Tavus CVI */}
        <div className="relative flex items-center justify-center">
          {/* Orbiting metric indicators */}
          {orbitingMetrics.map((metric, index) => {
            const x = Math.cos((metric.position.angle * Math.PI) / 180) * metric.position.radius;
            const y = Math.sin((metric.position.angle * Math.PI) / 180) * metric.position.radius;

            return (
              <motion.div
                key={metric.label}
                className="absolute"
                style={{
                  left: `calc(50% + ${x}px)`,
                  top: `calc(50% + ${y}px)`,
                  transform: 'translate(-50%, -50%)'
                }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: connected ? 1 : 0.3,
                  scale: 1,
                  rotate: metrics.conversation_active ? 360 : 0
                }}
                transition={{
                  delay: index * 0.2,
                  rotate: { duration: 8, repeat: Infinity, ease: "linear" }
                }}
              >
                <div className="bg-black/60 backdrop-blur-md border border-gray-700/50 rounded-lg p-3 min-w-[80px]">
                  <div className="flex items-center space-x-2">
                    <metric.icon className={`w-4 h-4 ${metric.color}`} />
                    <div>
                      <div className="text-xs text-gray-400">{metric.label}</div>
                      <div className={`text-sm font-mono ${metric.color}`}>
                        {metric.value.toFixed(0)}%
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {/* Central Avatar Orb with transparent Tavus conversation */}
          <motion.div
            className="relative"
            animate={{
              scale: connected ? 1 : 0.8,
              opacity: connected ? 1 : 0.6
            }}
            transition={{ duration: 1 }}
          >
            {/* Outer pulsing ring */}
            <motion.div
              className={`absolute inset-0 rounded-full bg-gradient-to-r ${getEmotionColor(metrics.current_emotion)} opacity-20`}
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.2, 0.4, 0.2]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              style={{
                width: avatarSize + 40,
                height: avatarSize + 40,
                left: -20,
                top: -20
              }}
            />

            {/* Middle ring */}
            <motion.div
              className={`absolute inset-0 rounded-full bg-gradient-to-r ${getEmotionColor(metrics.current_emotion)} opacity-30 border-2 border-white/10`}
              animate={{
                rotate: 360
              }}
              transition={{
                duration: 10,
                repeat: Infinity,
                ease: "linear"
              }}
              style={{
                width: avatarSize + 20,
                height: avatarSize + 20,
                left: -10,
                top: -10
              }}
            />

            {/* Main avatar bubble with Tavus CVI Conversation */}
            <motion.div
              className={`rounded-full bg-gradient-to-br ${getEmotionColor(metrics.current_emotion)} p-1 backdrop-blur-xl border border-white/20 shadow-2xl overflow-hidden`}
              style={{
                width: avatarSize,
                height: avatarSize
              }}
              animate={{
                boxShadow: connected
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
            >
               <div className="w-full h-full rounded-full bg-transparent relative overflow-hidden">
                 {/* Tavus CVI Conversation with Chroma Key Effect */}
                 <TavusChromaKeyOrb
                   conversationUrl="https://tavus.daily.co/c0907fea948964bc"
                   className="w-full h-full"
                 />

                {/* Status overlays */}
                <motion.div
                  className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-center pointer-events-none"
                  animate={{ opacity: connected ? 1 : 0.5 }}
                >
                  <div className="text-xs text-cyan-400/70 bg-black/60 rounded px-2 py-1">
                    {metrics.current_emotion.toUpperCase()} • {metrics.current_topic.toUpperCase()}
                  </div>
                </motion.div>

                {/* Activity indicator */}
                {metrics.conversation_active && (
                  <motion.div
                    className="absolute top-4 right-4 pointer-events-none"
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
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* External Controls Panel - Positioned below the orb */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="absolute left-1/2 transform -translate-x-1/2 bg-black/60 backdrop-blur-md border border-gray-700/50 rounded-xl p-3"
          style={{ top: `calc(50% + ${avatarSize/2 + 40}px)` }}
        >
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 transition-all hover:bg-green-500/30">
              <MicSelectBtn />
            </div>

            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 transition-all hover:bg-blue-500/30">
              <CameraSelectBtn />
            </div>

            <button className="flex items-center justify-center w-12 h-12 rounded-lg bg-gray-500/20 text-gray-400 border border-gray-500/30 transition-all hover:bg-gray-500/30">
              <Settings className="w-5 h-5" />
            </button>
          </div>

          <div className="text-xs text-gray-400 text-center mt-2">
            Tavus Controls • Aurora Interface
          </div>
        </motion.div>

        {/* Conversation ended overlay */}
        {conversationEnded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center"
          >
            <div className="bg-black/80 border border-gray-700/50 rounded-xl p-6 text-center">
              <div className="text-xl text-white mb-2">Conversation Ended</div>
              <div className="text-gray-400 text-sm">Aurora session has concluded</div>
              <button
                onClick={() => setConversationEnded(false)}
                className="mt-4 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
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