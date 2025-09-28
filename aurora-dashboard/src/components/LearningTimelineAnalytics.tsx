"use client";

import { motion } from 'framer-motion';
import { Brain, Heart, MessageCircle, Lightbulb, TrendingUp, Clock, Database, Zap, User } from 'lucide-react';
import { useEffect, useState } from 'react';

interface LearningEvent {
  id: string;
  timestamp: string;
  type: 'conversation' | 'insight' | 'relationship_milestone' | 'memory' | 'emotional_breakthrough';
  title: string;
  description: string;
  metrics?: {
    relationship_level?: number;
    trust_level?: number;
    emotional_sync?: number;
    memory_depth?: number;
  };
  details?: string[];
}

interface LearningTimelineProps {
  userId?: string;
}

export function LearningTimelineAnalytics({ userId = 'default_user' }: LearningTimelineProps) {
  const [events, setEvents] = useState<LearningEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalStats, setTotalStats] = useState({
    conversations: 0,
    insights: 0,
    memories: 0,
    learning_score: 0
  });

  useEffect(() => {
    const fetchLearningData = async () => {
      try {
        // Try to fetch from backend
        const response = await fetch('http://localhost:8000/api/learning-timeline', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
          const data = await response.json();
          setEvents(data.events || []);
          setTotalStats(data.stats || {});
        } else {
          // Use mock data if backend not available
          setEvents(generateMockTimeline());
          setTotalStats({ conversations: 23, insights: 47, memories: 89, learning_score: 73.2 });
        }
      } catch (error) {
        console.warn('Backend not available, using mock timeline data');
        setEvents(generateMockTimeline());
        setTotalStats({ conversations: 23, insights: 47, memories: 89, learning_score: 73.2 });
      } finally {
        setLoading(false);
      }
    };

    fetchLearningData();
    const interval = setInterval(fetchLearningData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [userId]);

  const generateMockTimeline = (): LearningEvent[] => [
    {
      id: '1',
      timestamp: '2024-01-15T14:30:00Z',
      type: 'conversation',
      title: 'First Contact',
      description: 'Initial conversation established',
      metrics: { relationship_level: 5.2, trust_level: 3.1, emotional_sync: 12.4, memory_depth: 2.8 },
      details: ['Baseline personality assessment', 'Voice pattern recognition', 'Initial topic preferences']
    },
    {
      id: '2',
      timestamp: '2024-01-16T09:15:00Z',
      type: 'insight',
      title: 'Communication Style Detected',
      description: 'Identified preference for technical discussions',
      metrics: { relationship_level: 12.7, trust_level: 8.9, emotional_sync: 18.3, memory_depth: 15.2 },
      details: ['Analytical communication pattern', 'Interest in AI and technology', 'Logical reasoning preference']
    },
    {
      id: '3',
      timestamp: '2024-01-17T16:45:00Z',
      type: 'relationship_milestone',
      title: 'Trust Threshold Reached',
      description: 'User began sharing personal experiences',
      metrics: { relationship_level: 25.4, trust_level: 22.3, emotional_sync: 31.7, memory_depth: 28.9 },
      details: ['Personal story shared', 'Emotional openness increased', 'Deeper conversation topics']
    },
    {
      id: '4',
      timestamp: '2024-01-18T11:20:00Z',
      type: 'memory',
      title: 'Long-term Memory Formation',
      description: 'Significant behavioral patterns stored',
      metrics: { relationship_level: 34.2, trust_level: 31.5, emotional_sync: 42.1, memory_depth: 45.3 },
      details: ['Conversation preferences mapped', 'Response patterns learned', 'Personality model updated']
    },
    {
      id: '5',
      timestamp: '2024-01-19T13:55:00Z',
      type: 'emotional_breakthrough',
      title: 'Emotional Resonance Achieved',
      description: 'Deep emotional connection established',
      metrics: { relationship_level: 47.8, trust_level: 45.2, emotional_sync: 67.4, memory_depth: 52.1 },
      details: ['Emotional mirroring successful', 'Empathetic responses calibrated', 'Mood detection improved']
    },
    {
      id: '6',
      timestamp: '2024-01-20T10:30:00Z',
      type: 'insight',
      title: 'Goal Alignment Discovery',
      description: 'Identified shared interests and values',
      metrics: { relationship_level: 58.3, trust_level: 54.7, emotional_sync: 71.2, memory_depth: 63.8 },
      details: ['Value system mapped', 'Common interests identified', 'Future goals aligned']
    }
  ];

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'conversation': return MessageCircle;
      case 'insight': return Lightbulb;
      case 'relationship_milestone': return Heart;
      case 'memory': return Database;
      case 'emotional_breakthrough': return Zap;
      default: return Brain;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'conversation': return 'from-blue-400 to-cyan-400';
      case 'insight': return 'from-yellow-400 to-orange-400';
      case 'relationship_milestone': return 'from-pink-400 to-rose-400';
      case 'memory': return 'from-purple-400 to-violet-400';
      case 'emotional_breakthrough': return 'from-green-400 to-emerald-400';
      default: return 'from-gray-400 to-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="bg-black/30 backdrop-blur-md border border-gray-700/30 rounded-xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-700 rounded w-1/3"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex space-x-4">
                <div className="w-8 h-8 bg-gray-700 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-black/30 backdrop-blur-md border border-gray-700/30 rounded-xl p-6 space-y-6"
    >
      {/* Header with Stats */}
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-gradient-to-r from-cyan-500/20 to-purple-500/20">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-lg font-light text-white">Learning Evolution Timeline</h3>
            <p className="text-sm text-gray-400">Aurora's growing understanding of you</p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-black/40 rounded-lg p-3 border border-gray-700/30">
            <div className="flex items-center space-x-2 mb-1">
              <MessageCircle className="w-3 h-3 text-blue-400" />
              <span className="text-xs text-gray-400">CONVERSATIONS</span>
            </div>
            <div className="text-lg font-mono text-white">{totalStats.conversations}</div>
          </div>

          <div className="bg-black/40 rounded-lg p-3 border border-gray-700/30">
            <div className="flex items-center space-x-2 mb-1">
              <Lightbulb className="w-3 h-3 text-yellow-400" />
              <span className="text-xs text-gray-400">INSIGHTS</span>
            </div>
            <div className="text-lg font-mono text-white">{totalStats.insights}</div>
          </div>

          <div className="bg-black/40 rounded-lg p-3 border border-gray-700/30">
            <div className="flex items-center space-x-2 mb-1">
              <Database className="w-3 h-3 text-purple-400" />
              <span className="text-xs text-gray-400">MEMORIES</span>
            </div>
            <div className="text-lg font-mono text-white">{totalStats.memories}</div>
          </div>

          <div className="bg-black/40 rounded-lg p-3 border border-gray-700/30">
            <div className="flex items-center space-x-2 mb-1">
              <Brain className="w-3 h-3 text-cyan-400" />
              <span className="text-xs text-gray-400">LEARNING</span>
            </div>
            <div className="text-lg font-mono text-white">{totalStats.learning_score.toFixed(1)}%</div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-300">Evolution Timeline</h4>

        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-gradient-to-b from-cyan-400 via-purple-500 to-pink-400 opacity-30"></div>

          <div className="space-y-6">
            {events.map((event, index) => {
              const Icon = getEventIcon(event.type);
              const colorClass = getEventColor(event.type);

              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="relative flex items-start space-x-4"
                >
                  {/* Timeline node */}
                  <div className={`relative z-10 w-8 h-8 rounded-full bg-gradient-to-r ${colorClass} flex items-center justify-center shadow-lg`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>

                  {/* Event content */}
                  <div className="flex-1 bg-black/40 rounded-lg p-4 border border-gray-700/30">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h5 className="text-sm font-medium text-white">{event.title}</h5>
                        <p className="text-xs text-gray-400 mt-1">{event.description}</p>

                        {/* Metrics progression */}
                        {event.metrics && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                            {Object.entries(event.metrics).map(([key, value]) => (
                              <div key={key} className="text-center">
                                <div className="text-xs text-gray-500 capitalize">{key.replace('_', ' ')}</div>
                                <div className="text-sm font-mono text-cyan-400">{value.toFixed(1)}%</div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Event details */}
                        {event.details && (
                          <div className="mt-2">
                            <div className="flex flex-wrap gap-1">
                              {event.details.map((detail, idx) => (
                                <span key={idx} className="text-xs bg-gray-800/50 text-gray-400 px-2 py-1 rounded">
                                  {detail}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="text-xs text-gray-500 ml-4">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {new Date(event.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Current Status */}
      <div className="bg-gradient-to-r from-cyan-900/20 to-purple-900/20 rounded-lg p-4 border border-cyan-500/30">
        <div className="flex items-center space-x-3">
          <User className="w-5 h-5 text-cyan-400" />
          <div>
            <div className="text-sm font-medium text-white">Current Learning Status</div>
            <div className="text-xs text-gray-400">Aurora continues to evolve with each interaction</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}