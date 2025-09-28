"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CustomAuroraLayout } from '@/components/CustomAuroraLayout';
import { MetricCard } from '@/components/MetricCard';
import { InsightPanel } from '@/components/InsightPanel';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { AnalyticsPanel } from '@/components/AnalyticsPanel';
import { InteractionGuide } from '@/components/InteractionGuide';
import { ClientOnly } from '@/components/ClientOnly';
import { Brain, Heart, Zap, Database, Settings, Activity, Palette } from 'lucide-react';

interface LiveMetrics {
  relationship_level: number;
  trust_level: number;
  emotional_sync: number;
  memory_depth: number;
  current_emotion: string;
  current_topic: string;
  insights_count: number;
  conversation_turns: number;
  recent_insights: string[];
  conversation_active: boolean;
  last_updated: string;
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<LiveMetrics>({
    relationship_level: 25.0,
    trust_level: 35.0,
    emotional_sync: 45.0,
    memory_depth: 15.0,
    current_emotion: "neutral",
    current_topic: "general",
    insights_count: 0,
    conversation_turns: 0,
    recent_insights: [],
    conversation_active: false,
    last_updated: new Date().toISOString()
  });

  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'main' | 'analytics' | 'settings' | 'orb'>('main');
  const [userId, setUserId] = useState('default_user');
  const [mounted, setMounted] = useState(false);

  const fetchMetrics = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/metrics');
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
        setConnected(true);
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);

    // Get user name from localStorage
    const userName = localStorage.getItem('aurora_user_name');
    if (userName) {
      setUserId(userName.toLowerCase().replace(/\s+/g, '_'));
    }

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 2000); // Update every 2 seconds
    return () => clearInterval(interval);
  }, []);

  // Don't render until mounted to avoid hydration mismatch
  if (!mounted) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 animate-spin" />
          <span className="text-cyan-400 font-mono">INITIALIZING AURORA...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative" suppressHydrationWarning>
      {/* Animated background grid */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <div className="absolute inset-0 neural-grid opacity-20" />
      </div>

      {/* Tesla-style header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 flex justify-between items-center p-6 border-b border-gray-800/50 backdrop-blur-sm"
      >
        <div className="flex items-center space-x-4">
          <motion.div
            animate={{ rotate: metrics.conversation_active ? 360 : 0 }}
            transition={{ duration: 2, repeat: metrics.conversation_active ? Infinity : 0 }}
            className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 flex items-center justify-center"
          >
            <Brain className="w-4 h-4" />
          </motion.div>
          <div>
            <h1 className="text-2xl font-light tracking-wide">AURORA</h1>
            <p className="text-gray-400 text-sm">Neural Interface Dashboard</p>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-black/40 rounded-lg p-1">
            {[
              { key: 'main', icon: Brain, label: 'Main' },
              { key: 'analytics', icon: Activity, label: 'Analytics' },
              { key: 'orb', icon: Palette, label: 'Orb Demo' },
              { key: 'settings', icon: Settings, label: 'Settings' }
            ].map(({ key, icon: Icon, label }) => (
              <motion.button
                key={key}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveView(key as any)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all ${
                  activeView === key
                    ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{label}</span>
              </motion.button>
            ))}
          </div>
          <ConnectionStatus connected={connected} loading={loading} />
        </div>
      </motion.div>

      {/* Main content area */}
      <div className="relative z-10 p-6 h-[calc(100vh-100px)]">
        {activeView === 'main' && (
          <div className="flex flex-col h-full">
            {/* Top row with metrics and orb */}
            <div className="flex-1 flex items-center justify-center">
              <div className="grid grid-cols-12 gap-6 w-full max-w-7xl">
                {/* Left metrics panel */}
                <motion.div
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="col-span-3 space-y-4"
                >
                  <MetricCard
                    title="Relationship"
                    value={metrics.relationship_level}
                    max={100}
                    icon={<Heart className="w-5 h-5" />}
                    color="from-pink-500 to-rose-500"
                    trend={metrics.conversation_active ? 'up' : 'stable'}
                  />
                  <MetricCard
                    title="Trust Level"
                    value={metrics.trust_level}
                    max={100}
                    icon={<Database className="w-5 h-5" />}
                    color="from-blue-500 to-cyan-500"
                    trend={metrics.conversation_turns > 5 ? 'up' : 'stable'}
                  />
                </motion.div>

                {/* Central avatar with real Tavus video */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 }}
                  className="col-span-6 flex items-center justify-center"
                >
                  <ClientOnly fallback={
                    <div className="w-80 h-80 rounded-full bg-black/80 flex items-center justify-center">
                      <div className="text-cyan-400 font-mono">LOADING AVATAR...</div>
                    </div>
                  }>
                    <CustomAuroraLayout
                      metrics={metrics}
                      connected={connected}
                      userId={userId}
                      onSpeechProcessed={(result) => {
                        setMetrics(result.updated_metrics);
                      }}
                    />
                  </ClientOnly>
                </motion.div>

                {/* Right metrics panel */}
                <motion.div
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="col-span-3 space-y-4"
                >
                  <MetricCard
                    title="Emotional Sync"
                    value={metrics.emotional_sync}
                    max={100}
                    icon={<Zap className="w-5 h-5" />}
                    color="from-yellow-500 to-orange-500"
                    trend={metrics.current_emotion !== 'neutral' ? 'up' : 'stable'}
                  />
                  <MetricCard
                    title="Memory Depth"
                    value={metrics.memory_depth}
                    max={100}
                    icon={<Brain className="w-5 h-5" />}
                    color="from-purple-500 to-violet-500"
                    trend={metrics.insights_count > 0 ? 'up' : 'stable'}
                  />
                </motion.div>
              </div>
            </div>

            {/* Bottom insights panel */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="mt-6"
            >
              <InsightPanel insights={metrics.recent_insights} currentTopic={metrics.current_topic} currentEmotion={metrics.current_emotion} />
            </motion.div>

            {/* Interaction guide moved to bottom */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="mt-4"
            >
              <InteractionGuide />
            </motion.div>
          </div>
        )}

        {activeView === 'analytics' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="h-full"
          >
            <AnalyticsPanel userId={userId} />
          </motion.div>
        )}

        {activeView === 'orb' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="h-full flex items-center justify-center"
          >
            <div className="text-center space-y-4">
              <h2 className="text-2xl font-light text-white">Chroma Key Avatar Orb</h2>
              <p className="text-gray-400">Interactive demo with live customization</p>
              <motion.a
                href="/orb-demo"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg font-medium shadow-lg shadow-cyan-500/30"
              >
                <Palette className="w-5 h-5" />
                <span>Open Orb Demo</span>
              </motion.a>
            </div>
          </motion.div>
        )}

        {activeView === 'settings' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="h-full bg-black/30 backdrop-blur-md border border-gray-700/50 rounded-xl p-6"
          >
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-medium text-white mb-2">System Settings</h2>
                <p className="text-gray-400">Configure Aurora neural interface</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg text-gray-300">Connection</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Backend URL</span>
                      <span className="text-cyan-400 font-mono text-sm">localhost:8000</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Update Interval</span>
                      <span className="text-cyan-400 font-mono text-sm">2000ms</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Status</span>
                      <span className={`text-sm font-medium ${connected ? 'text-green-400' : 'text-red-400'}`}>
                        {connected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg text-gray-300">Metrics</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Conversations</span>
                      <span className="text-cyan-400 font-mono text-sm">{metrics.conversation_turns}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Insights</span>
                      <span className="text-cyan-400 font-mono text-sm">{metrics.insights_count}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Last Updated</span>
                      <span className="text-cyan-400 font-mono text-sm">
                        {new Date(metrics.last_updated).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-700/50 pt-6">
                <h3 className="text-lg text-gray-300 mb-4">Quick Actions</h3>
                <div className="flex space-x-4">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-cyan-500 text-white rounded-lg font-medium shadow-lg shadow-cyan-500/30"
                  >
                    Refresh Dashboard
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      fetch('http://localhost:8000/api/reset', { method: 'DELETE' })
                        .then(() => window.location.reload());
                    }}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium shadow-lg shadow-red-500/30"
                  >
                    Reset System
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Ambient light effects */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 rounded-full blur-3xl animate-pulse" />

      {/* Status indicators */}
      <div className="absolute bottom-6 right-6 flex space-x-2">
        <div className={`w-3 h-3 rounded-full ${metrics.conversation_active ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
        <div className={`w-3 h-3 rounded-full ${connected ? 'bg-blue-400 animate-pulse' : 'bg-red-400'}`} />
      </div>
    </div>
  );
}
