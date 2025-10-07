"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, MessageCircle, Brain, Zap } from 'lucide-react';
import { useState, useEffect } from 'react';

interface InsightPanelProps {
  insights: string[];
  currentTopic: string;
  currentEmotion: string;
}

export function InsightPanel({ insights, currentTopic, currentEmotion }: InsightPanelProps) {
  const [activeInsight, setActiveInsight] = useState(0);

  useEffect(() => {
    if (insights.length > 1) {
      const interval = setInterval(() => {
        setActiveInsight((prev) => (prev + 1) % insights.length);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [insights.length]);

  const getEmotionIcon = (emotion: string) => {
    switch (emotion) {
      case 'excited':
      case 'happy':
        return <Zap className="w-4 h-4 text-yellow-400" />;
      case 'curious':
        return <Brain className="w-4 h-4 text-purple-400" />;
      case 'anxious':
      case 'nervous':
        return <MessageCircle className="w-4 h-4 text-orange-400" />;
      default:
        return <Lightbulb className="w-4 h-4 text-cyan-400" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-black/30 backdrop-blur-md border border-gray-700/50 rounded-xl p-6 relative overflow-hidden"
    >
      {/* Background neural pattern */}
      <div className="absolute inset-0 opacity-5">
        <svg viewBox="0 0 400 100" className="w-full h-full">
          {Array.from({ length: 20 }, (_, i) => (
            <motion.circle
              key={i}
              cx={20 + i * 20}
              cy={50}
              r="1"
              fill="cyan"
              animate={{
                opacity: [0.3, 0.8, 0.3],
                scale: [1, 1.5, 1]
              }}
              transition={{
                duration: 2,
                delay: i * 0.1,
                repeat: Infinity
              }}
            />
          ))}
        </svg>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 bg-opacity-20">
            <Brain className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-white">Neural Insights</h3>
            <p className="text-sm text-gray-400">Real-time behavioral analysis</p>
          </div>
        </div>

        {/* Current state indicators */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-black/40 rounded-lg px-3 py-2">
            {getEmotionIcon(currentEmotion)}
            <span className="text-sm text-gray-300">{currentEmotion}</span>
          </div>
          <div className="flex items-center space-x-2 bg-black/40 rounded-lg px-3 py-2">
            <MessageCircle className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-gray-300">{currentTopic}</span>
          </div>
        </div>
      </div>

      {/* Insights display */}
      <div className="relative z-10">
        {insights.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-gray-700 to-gray-600 mb-4">
              <Lightbulb className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-gray-400">Gathering insights from conversation...</p>
            <div className="flex justify-center mt-4 space-x-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 bg-cyan-400 rounded-full"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 1, 0.5]
                  }}
                  transition={{
                    duration: 1,
                    delay: i * 0.3,
                    repeat: Infinity
                  }}
                />
              ))}
            </div>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {/* Insight counter */}
            {insights.length > 1 && (
              <div className="flex justify-center mb-4">
                <div className="flex space-x-1">
                  {insights.map((_, index) => (
                    <motion.div
                      key={index}
                      className={`w-2 h-2 rounded-full ${
                        index === activeInsight ? 'bg-cyan-400' : 'bg-gray-600'
                      }`}
                      animate={{
                        scale: index === activeInsight ? 1.2 : 1
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Active insight */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeInsight}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-lg p-4 border border-cyan-500/20"
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 flex items-center justify-center">
                      <Lightbulb className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="flex-grow">
                    <motion.p
                      className="text-gray-100 leading-relaxed"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                    >
                      {insights[activeInsight]}
                    </motion.p>
                    <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
                      <span>Insight {activeInsight + 1} of {insights.length}</span>
                      <span className="font-mono">
                        {new Date().toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* All insights preview */}
            {insights.length > 1 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-2 mt-4"
              >
                <h4 className="text-sm font-medium text-gray-400 mb-2">Recent Insights</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {insights.slice(-6).map((insight, index) => (
                    <motion.div
                      key={index}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        index === activeInsight
                          ? 'bg-cyan-500/20 border-cyan-500/40'
                          : 'bg-black/20 border-gray-700/30 hover:border-gray-600/50'
                      }`}
                      whileHover={{ scale: 1.02 }}
                      onClick={() => setActiveInsight(index)}
                    >
                      <p className="text-xs text-gray-300 line-clamp-2">
                        {insight}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* Ambient glow */}
      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-32 h-8 bg-gradient-to-t from-cyan-500/20 to-transparent blur-xl" />
    </motion.div>
  );
}