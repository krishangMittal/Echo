"use client";

import { motion } from 'framer-motion';
import { Brain, Zap, Heart, Database } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';

interface TavusCVIOrbProps {
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

export function TavusCVIOrb({ metrics, connected, userId = 'default_user', onSpeechProcessed }: TavusCVIOrbProps) {
  const [mounted, setMounted] = useState(false);
  const callRef = useRef<any>(null);

  useEffect(() => {
    setMounted(true);
    
    // Global cleanup on page unload
    const handleBeforeUnload = () => {
      const globalCall = (window as any).__globalDailyCall;
      if (globalCall) {
        try {
          globalCall.destroy();
        } catch (error) {
          console.warn('Error destroying global Daily call:', error);
        }
        (window as any).__globalDailyCall = null;
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Initialize Daily.js like the HTML client (this is what actually works)
  useEffect(() => {
    if (!mounted) return;

    const initializeDaily = async () => {
      try {
        // Import Daily.js dynamically (same as HTML client)
        const Daily = (await import('@daily-co/daily-js')).default;
        
        // Check for existing global instance to prevent duplicates
        const globalCall = (window as any).__globalDailyCall;
        if (globalCall) {
          console.log('♻️ Reusing existing global Daily call');
          callRef.current = globalCall;
          return;
        }
        
        // Create Daily frame (same as HTML client)
        const call = Daily.createFrame();
        callRef.current = call;
        (window as any).__globalDailyCall = call;

        // Set up event listeners (same as HTML client)
        call.on('app-message', (event: any) => {
          const data = event.data;
          console.log('App message:', data);
          
          if (data.event_type === 'conversation.utterance') {
            const speech = data.properties.speech;
            const role = data.properties.role;
            
            if (role === 'user' && speech) {
              console.log('🎤 User said:', speech);
              
              // Send to backend for processing (same as HTML client)
              fetch('http://localhost:8000/api/process-speech', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({text: speech, user_id: userId})
              })
              .then(response => response.json())
              .then(result => {
                console.log('🧠 Speech processed:', result);
                onSpeechProcessed?.(result);
              })
              .catch(err => {
                console.error('❌ Error processing speech:', err);
              });
              
            } else if (role === 'replica' && speech) {
              console.log('🤖 Aurora said:', speech);
            }
          }
        });
        
        call.on('joined-meeting', () => {
          console.log('✅ Connected to Aurora!');
        });
        
        call.on('error', (error: any) => {
          console.error('❌ Daily error:', error);
        });
        
        // Join the conversation (same as HTML client)
        const conversationURL = 'https://tavus.daily.co/cbbbce14bcb7545c';
        await call.join({ url: conversationURL });
        
      } catch (error) {
        console.error('❌ Failed to initialize Daily:', error);
      }
    };

    initializeDaily();

    return () => {
      // Don't destroy the global instance, just clear our reference
      callRef.current = null;
    };
  }, [mounted, userId, onSpeechProcessed]);

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

          {/* Main avatar bubble with Tavus CVI */}
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
               {/* Daily.js container for Tavus conversation */}
               <div
                 ref={(el) => {
                   if (el && callRef.current) {
                     // Attach the Daily frame to this container
                     const iframe = callRef.current.iframe();
                     if (iframe && !el.hasChildNodes()) {
                       iframe.style.width = '100%';
                       iframe.style.height = '100%';
                       iframe.style.border = 'none';
                       iframe.style.borderRadius = '50%';
                       iframe.style.overflow = 'hidden';
                       el.appendChild(iframe);
                     }
                   }
                 }}
                 className="absolute inset-0 w-full h-full rounded-full"
                 style={{
                   transform: 'scale(1.1)',
                   transformOrigin: 'center center',
                 }}
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
