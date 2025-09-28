"use client";

import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Activity, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { auroraAPI } from '@/lib/api';

interface AnalyticsPanelProps {
  userId?: string;
}

export function AnalyticsPanel({ userId = 'default_user' }: AnalyticsPanelProps) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const data = await auroraAPI.getUserAnalytics(userId);
        setAnalytics(data);
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 10000);
    return () => clearInterval(interval);
  }, [userId]);

  if (loading) {
    return (
      <div className="bg-black/30 backdrop-blur-md border border-gray-700/50 rounded-xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-700 rounded w-1/4"></div>
          <div className="h-8 bg-gray-700 rounded w-1/2"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-700 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!analytics || !analytics.conversation_analytics) {
    return (
      <div className="bg-black/30 backdrop-blur-md border border-gray-700/50 rounded-xl p-6 text-center">
        <Activity className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-gray-400">No analytics data available</p>
      </div>
    );
  }

  const { conversation_analytics, insight_analytics, behavioral_patterns } = analytics;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-black/30 backdrop-blur-md border border-gray-700/50 rounded-xl p-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center space-x-3">
        <div className="p-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 bg-opacity-20">
          <BarChart3 className="w-5 h-5 text-green-400" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-white">Analytics Overview</h3>
          <p className="text-sm text-gray-400">Behavioral and conversation patterns</p>
        </div>
      </div>

      {/* Key metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-black/40 rounded-lg p-3 border border-gray-700/30">
          <div className="flex items-center space-x-2 mb-2">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-gray-400">CONVERSATIONS</span>
          </div>
          <div className="text-xl font-mono text-white">
            {conversation_analytics.total_conversations}
          </div>
        </div>

        <div className="bg-black/40 rounded-lg p-3 border border-gray-700/30">
          <div className="flex items-center space-x-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-xs text-gray-400">AVG RELATIONSHIP</span>
          </div>
          <div className="text-xl font-mono text-white">
            {conversation_analytics.avg_relationship_level?.toFixed(1) || '0.0'}%
          </div>
        </div>

        <div className="bg-black/40 rounded-lg p-3 border border-gray-700/30">
          <div className="flex items-center space-x-2 mb-2">
            <Activity className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-gray-400">INSIGHTS</span>
          </div>
          <div className="text-xl font-mono text-white">
            {insight_analytics.total_insights}
          </div>
        </div>

        <div className="bg-black/40 rounded-lg p-3 border border-gray-700/30">
          <div className="flex items-center space-x-2 mb-2">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-gray-400">CONFIDENCE</span>
          </div>
          <div className="text-xl font-mono text-white">
            {(insight_analytics.avg_confidence * 100)?.toFixed(0) || '0'}%
          </div>
        </div>
      </div>

      {/* Behavioral patterns */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-300">Behavioral Patterns</h4>

        {/* Topics distribution */}
        {behavioral_patterns.dominant_topics && Object.keys(behavioral_patterns.dominant_topics).length > 0 && (
          <div className="space-y-2">
            <span className="text-xs text-gray-400">FREQUENT TOPICS</span>
            <div className="space-y-1">
              {Object.entries(behavioral_patterns.dominant_topics)
                .slice(0, 5)
                .map(([topic, count], index) => {
                  const percentage = (count as number / conversation_analytics.total_conversations) * 100;
                  return (
                    <div key={topic} className="flex items-center justify-between">
                      <span className="text-sm text-gray-300 capitalize">{topic}</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-20 bg-gray-800 rounded-full h-1.5 overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ delay: index * 0.1, duration: 0.8 }}
                          />
                        </div>
                        <span className="text-xs font-mono text-gray-400">{count}</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Insight categories */}
        {insight_analytics.insights_by_category && Object.keys(insight_analytics.insights_by_category).length > 0 && (
          <div className="space-y-2">
            <span className="text-xs text-gray-400">INSIGHT CATEGORIES</span>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(insight_analytics.insights_by_category)
                .slice(0, 4)
                .map(([category, count]) => (
                  <div key={category} className="bg-black/40 rounded-lg p-2 border border-gray-700/30">
                    <div className="text-xs text-gray-400 uppercase">{category}</div>
                    <div className="text-sm font-mono text-cyan-400">{count}</div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Progress indicators */}
      {conversation_analytics.relationship_progression && conversation_analytics.relationship_progression.length > 1 && (
        <div className="space-y-2">
          <span className="text-xs text-gray-400">RELATIONSHIP PROGRESSION</span>
          <div className="flex items-end space-x-1 h-16">
            {conversation_analytics.relationship_progression.slice(-10).map((value, index) => (
              <motion.div
                key={index}
                className="bg-gradient-to-t from-pink-500 to-rose-400 rounded-sm flex-1 min-w-[2px]"
                initial={{ height: 0 }}
                animate={{ height: `${(value / 100) * 100}%` }}
                transition={{ delay: index * 0.05, duration: 0.5 }}
              />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}