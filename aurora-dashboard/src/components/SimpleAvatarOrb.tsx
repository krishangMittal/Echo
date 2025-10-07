"use client";

import { motion } from 'framer-motion';
import { Brain, Zap, Heart, Database } from 'lucide-react';

interface SimpleAvatarOrbProps {
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

export function SimpleAvatarOrb({ metrics, connected, userId = 'default_user' }: SimpleAvatarOrbProps) {
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

  return (
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

      {/* Central Avatar Orb */}
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

        {/* Main avatar bubble with iframe */}
        <motion.div
          className={`rounded-full bg-gradient-to-br ${getEmotionColor(metrics.current_emotion)} p-2 backdrop-blur-xl border border-white/20 shadow-2xl overflow-hidden`}
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
          <div className="w-full h-full rounded-full bg-black/80 backdrop-blur-md relative overflow-hidden">

            {/* Tavus iframe - Direct embed */}
            <iframe
              src="https://tavus.daily.co/cfc548d2c897a4bb"
              className="absolute inset-0 w-full h-full rounded-full"
              style={{
                border: 'none',
                transform: 'scale(1.1)', // Slight zoom to fill circle better
              }}
              allow="camera; microphone; autoplay"
            />

            {/* Status overlays */}
            <motion.div
              className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-center"
              animate={{ opacity: connected ? 1 : 0.5 }}
            >
              <div className="text-xs text-cyan-400/70 bg-black/60 rounded px-2 py-1">
                {metrics.current_emotion.toUpperCase()} • {metrics.current_topic.toUpperCase()}
              </div>
            </motion.div>

            {/* Activity indicator */}
            {metrics.conversation_active && (
              <motion.div
                className="absolute top-4 right-4"
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
  );
}