"use client";

import { motion } from 'framer-motion';
import { Brain, Zap, Heart, Database } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface AvatarWithMessageHandlerProps {
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

// Provide a global singleton for DailyIframe across HMR/StrictMode
declare global {
  interface Window { __dailySingleton?: any }
}
async function getDailySingleton() {
  if (typeof window === 'undefined') return null;
  if (window.__dailySingleton) return window.__dailySingleton;
  const DailyIframe = (await import('@daily-co/daily-js')).default;
  window.__dailySingleton = DailyIframe;
  return DailyIframe;
}

export function AvatarWithMessageHandler({ metrics, connected, userId = 'default_user', onSpeechProcessed }: AvatarWithMessageHandlerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callFrameRef = useRef<any>(null);

  // Initialize Daily.js frame and event listeners
  useEffect(() => {
    let destroyed = false;
    const container = containerRef.current;
    if (!container) return;

    (async () => {
      try {
        const DailyIframe = await getDailySingleton();
        if (!DailyIframe) return;

        // Prevent duplicate DailyIframe instances during re-renders/HMR
        if (callFrameRef.current) {
          console.log('♻️ Reusing existing Daily call frame');
          return;
        }

        // If the container already has an iframe, adopt its instance
        const existingIframe = container.querySelector('iframe');
        if (existingIframe) {
          const adopted = DailyIframe.getCallInstance?.();
          if (adopted) {
            console.log('🫶 Adopting existing Daily iframe instance');
            callFrameRef.current = adopted;
            return;
          }
        }

        const existing = DailyIframe.getCallInstance?.();
        if (existing) {
          console.log('🧲 Found global Daily instance; adopting instead of creating');
          callFrameRef.current = existing;
          return;
        }

        // Create Daily frame (first and only one)
        let callFrame;
        try {
          callFrame = DailyIframe.createFrame(container, {
            url: 'https://tavus.daily.co/cfc548d2c897a4bb',
            showLeaveButton: false,
            showFullscreenButton: false,
            showLocalVideo: false,
            showParticipantsBar: false,
          });
        } catch (err: any) {
          if (String(err?.message || err).includes('Duplicate DailyIframe')) {
            const fallback = DailyIframe.getCallInstance?.();
            if (fallback) {
              console.warn('⚠️ Duplicate create detected; adopting existing Daily instance');
              callFrameRef.current = fallback;
              return;
            }
            throw err;
          }
          throw err;
        }

        if (destroyed) {
          try { callFrame.destroy(); } catch {}
          return;
        }

        callFrameRef.current = callFrame;

        // Listen for app messages (this is how Tavus sends conversation events)
        callFrame.on('app-message', async (event: any) => {
          const data = event.data;
          console.log('✅ App message from Tavus:', data);

          if (data.event_type === 'conversation.utterance') {
            const speech = data.properties?.speech;
            const role = data.properties?.role;

            if (role === 'user' && speech) {
              console.log('🎤 User said:', speech);

              try {
                // Send to Aurora backend for processing
                const response = await fetch('http://localhost:8000/api/process-speech', {
                  method: 'POST',
                  headers: {'Content-Type': 'application/json'},
                  body: JSON.stringify({text: speech, user_id: userId})
                });

                if (response.ok) {
                  const result = await response.json();
                  console.log('🧠 Speech processed:', result);
                  onSpeechProcessed?.(result);
                } else {
                  console.error('❌ Backend response error:', response.status, response.statusText);
                }
              } catch (error) {
                console.error('❌ Error processing speech:', error);
              }
            } else if (role === 'replica' && speech) {
              console.log('🤖 Aurora said:', speech);
            }
          } else if (data.event_type === 'conversation.user.started_speaking') {
            console.log('🎤 User started speaking...');
          } else if (data.event_type === 'conversation.user.stopped_speaking') {
            console.log('🤐 User stopped speaking.');
          }
        });

        // Join the call once
        callFrame.join().then(() => {
          console.log('✅ Joined Tavus conversation successfully!');
        }).catch((error: any) => {
          console.error('❌ Failed to join conversation:', error);
        });
      } catch (error) {
        console.error('❌ Failed to initialize Daily frame:', error);
      }
    })();

    // Cleanup
    return () => {
      destroyed = true;
      if (callFrameRef.current) {
        console.log('🧹 Cleaning up Daily frame...');
        try { callFrameRef.current.destroy(); } catch {}
        callFrameRef.current = null;
      }
    };
  // Only run once on mount; userId/onSpeechProcessed are handled inside without re-creating the frame
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

        {/* Main avatar bubble with iframe container */}
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
            {/* Daily.js container for Tavus */}
            <div
              ref={containerRef}
              className="absolute inset-0 w-full h-full rounded-full"
              style={{
                transform: 'scale(1.1)',
                transformOrigin: 'center center',
              }}
            />
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}