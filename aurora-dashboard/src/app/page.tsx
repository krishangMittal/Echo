"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CustomAuroraLayout } from '@/components/CustomAuroraLayout';
import { MetricCard } from '@/components/MetricCard';
import { InsightPanel } from '@/components/InsightPanel';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { LearningTimelineAnalytics } from '@/components/LearningTimelineAnalytics';
import { InteractionGuide } from '@/components/InteractionGuide';
import { ClientOnly } from '@/components/ClientOnly';
import { StartConversationLanding } from '@/components/StartConversationLanding';
import { MicSelectBtn, CameraSelectBtn } from '@/components/cvi/components/device-select';
import { LocalVideoStream } from '@/components/LocalVideoStream';
import { Brain, Heart, Zap, Database, Settings, Activity, Palette, MessageCircle, User } from 'lucide-react';

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
  const [activeView, setActiveView] = useState<'main' | 'analytics' | 'settings' | 'start'>('start');
  const [userId, setUserId] = useState('default_user');
  const [mounted, setMounted] = useState(false);
  const [currentConversationUrl, setCurrentConversationUrl] = useState<string | null>(null);

  const fetchMetrics = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/metrics', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // Add timeout to prevent hanging
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
        setConnected(true);
        console.log('✅ Metrics fetched successfully:', data);
      } else {
        console.warn('⚠️ Backend responded with status:', response.status);
        setConnected(false);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn('⏰ Backend request timed out - server may be starting up');
      } else if (error.message.includes('Failed to fetch')) {
        console.warn('🔌 Backend not available - make sure final_aurora.py is running');
      } else {
        console.error('❌ Failed to fetch metrics:', error);
      }
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
    const interval = setInterval(fetchMetrics, 5000); // Update every 5 seconds to reduce load
    return () => clearInterval(interval);
  }, []);

  const handleConversationStart = (conversationData: any) => {
    setCurrentConversationUrl(conversationData.conversation_url);
    setActiveView('main');
    console.log('🚀 Conversation started, switching to main view:', conversationData);
  };

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
      {/* Tesla/Gemini-inspired animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-black to-gray-950">
        <div className="absolute inset-0 neural-grid opacity-10" />

        {/* Gemini-style gradient orbs */}
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-purple-500/10 via-cyan-500/10 to-blue-500/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />

        <motion.div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.1, 0.15, 0.1],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2
          }}
        />

        {/* Tesla-style subtle grid overlay */}
        <div className="absolute inset-0 opacity-5">
          <svg width="100%" height="100%" className="absolute inset-0">
            <defs>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="cyan" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>
      </div>

      {/* Minimal Top Bar with Navigation and Logo */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 flex justify-between items-center p-6"
      >
        {/* Tesla/Gemini-style Navigation */}
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-1 bg-black/50 backdrop-blur-md rounded-xl p-1 border border-gray-700/30">
            {[
              { key: 'start', icon: MessageCircle, label: 'Start' },
              { key: 'main', icon: Brain, label: 'Main' },
              { key: 'analytics', icon: Activity, label: 'Analytics' },
              { key: 'settings', icon: Settings, label: 'Settings' }
            ].map(({ key, icon: Icon, label }) => (
              <motion.button
                key={key}
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveView(key as any)}
                className={`relative flex items-center space-x-2 px-4 py-2.5 rounded-lg transition-all duration-300 font-light text-sm ${
                  activeView === key
                    ? 'bg-gradient-to-r from-cyan-500/90 via-blue-500/90 to-purple-500/90 text-white shadow-lg shadow-cyan-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>

                {/* Tesla-style active indicator */}
                {activeView === key && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute inset-0 rounded-lg bg-gradient-to-r from-cyan-400/20 via-blue-500/20 to-purple-500/20"
                    initial={false}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Aurora Logo - Top Right */}
        <div className="flex items-center space-x-4">
          <div>
            <h1 className="text-xl font-extralight tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500">
              AURORA
            </h1>
          </div>
        </div>
      </motion.div>

      {/* Main content area */}
      <div className="relative z-10 p-6 h-[calc(100vh-100px)]">
        {activeView === 'start' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="h-full"
          >
            <StartConversationLanding
              onConversationStart={handleConversationStart}
              userId={userId}
            />
          </motion.div>
        )}

        {activeView === 'main' && (
          <div className="relative w-full h-full">
            {/* MASSIVE Central Avatar - Full Screen */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="w-full h-full max-w-none">
                <ClientOnly fallback={
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-cyan-400 font-mono text-3xl animate-pulse">INITIALIZING AURORA...</div>
                  </div>
                }>
                  <CustomAuroraLayout
                    metrics={metrics}
                    connected={connected}
                    userId={userId}
                    conversationUrl={currentConversationUrl}
                    onSpeechProcessed={(result) => {
                      setMetrics(result.updated_metrics);
                    }}
                  />
                </ClientOnly>
              </div>
            </motion.div>

            {/* Right side panel - Floating over avatar */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
              className="absolute top-6 right-6 w-80 space-y-4 z-10"
            >
              {/* Personal Video Stream */}
              <div className="bg-black/30 backdrop-blur-md border border-gray-700/30 rounded-xl p-4">
                <h3 className="text-sm font-light text-gray-300 mb-3 flex items-center space-x-2">
                  <User className="w-4 h-4" />
                  <span>Your Stream</span>
                </h3>
                <div className="aspect-video bg-gray-900/50 rounded-lg border border-gray-700/30 flex items-center justify-center relative overflow-hidden">
                  <ClientOnly fallback={
                    <div className="text-gray-500 text-sm">Loading camera...</div>
                  }>
                    {/* User's local video stream using CVI components */}
                    <LocalVideoStream className="w-full h-full" />
                  </ClientOnly>
                </div>
              </div>

              {/* Compact Metrics */}
              <div className="space-y-3">
                <h3 className="text-sm font-light text-gray-300 mb-3">Neural Metrics</h3>

                <MetricCard
                  title="Relationship"
                  value={metrics.relationship_level}
                  max={100}
                  icon={<Heart className="w-4 h-4" />}
                  color="from-pink-500 to-rose-500"
                  trend={metrics.conversation_active ? 'up' : 'stable'}
                />

                <MetricCard
                  title="Trust Level"
                  value={metrics.trust_level}
                  max={100}
                  icon={<Database className="w-4 h-4" />}
                  color="from-blue-500 to-cyan-500"
                  trend={metrics.conversation_turns > 5 ? 'up' : 'stable'}
                />

                <MetricCard
                  title="Emotional Sync"
                  value={metrics.emotional_sync}
                  max={100}
                  icon={<Zap className="w-4 h-4" />}
                  color="from-yellow-500 to-orange-500"
                  trend={metrics.current_emotion !== 'neutral' ? 'up' : 'stable'}
                />

                <MetricCard
                  title="Memory Depth"
                  value={metrics.memory_depth}
                  max={100}
                  icon={<Brain className="w-4 h-4" />}
                  color="from-purple-500 to-violet-500"
                  trend={metrics.insights_count > 0 ? 'up' : 'stable'}
                />
              </div>
            </motion.div>

            {/* Left side panel - Floating over avatar */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 }}
              className="absolute top-6 left-6 w-80 space-y-4 z-10"
            >
              {/* Connection Status */}
              <div className="bg-black/30 backdrop-blur-md border border-gray-700/30 rounded-xl p-4">
                <h3 className="text-sm font-light text-gray-300 mb-3">System Status</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Neural Link</span>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'} animate-pulse`}></div>
                      <span className="text-xs text-gray-300">{connected ? 'Online' : 'Offline'}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Conversation</span>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${metrics.conversation_active ? 'bg-cyan-400' : 'bg-gray-500'} animate-pulse`}></div>
                      <span className="text-xs text-gray-300">{metrics.conversation_active ? 'Active' : 'Standby'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Metrics Preview */}
              <div className="bg-black/30 backdrop-blur-md border border-gray-700/30 rounded-xl p-4">
                <h3 className="text-sm font-light text-gray-300 mb-3">Neural Metrics</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Relationship</span>
                    <span className="text-xs text-pink-400">{metrics.relationship_level.toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Trust</span>
                    <span className="text-xs text-blue-400">{metrics.trust_level.toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Emotional Sync</span>
                    <span className="text-xs text-yellow-400">{metrics.emotional_sync.toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Memory Depth</span>
                    <span className="text-xs text-purple-400">{metrics.memory_depth.toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}

      {/* Bottom Control Panel - Fixed at bottom center for main view */}
      {activeView === 'main' && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-20"
        >
          <div className="bg-black/50 backdrop-blur-xl border border-gray-700/30 rounded-2xl p-4">
            <div className="flex items-center space-x-6">
              {/* CVI Media Controls */}
              <ClientOnly fallback={<div className="flex space-x-3">Loading controls...</div>}>
                <div className="flex items-center space-x-3">
                  {/* Microphone Control */}
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-12 h-12 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center text-green-400 hover:bg-green-500/30 transition-all"
                  >
                    <MicSelectBtn />
                  </motion.div>

                  {/* Camera Control */}
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-12 h-12 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 hover:bg-blue-500/30 transition-all"
                  >
                    <CameraSelectBtn />
                  </motion.div>

                  {/* Settings Control */}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-12 h-12 rounded-full bg-gray-500/20 border border-gray-500/30 flex items-center justify-center text-gray-400 hover:bg-gray-500/30 transition-all"
                  >
                    <Settings className="w-5 h-5" />
                  </motion.button>
                </div>
              </ClientOnly>

              {/* Session Info */}
              <div className="flex flex-col items-center">
                <div className="text-xs text-gray-400 font-light">Neural Session</div>
                <div className="text-sm text-cyan-400 font-mono">{userId}</div>
              </div>
            </div>
          </div>
        </motion.div>
      )}


        {activeView === 'analytics' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="h-full"
          >
            <LearningTimelineAnalytics userId={userId} />
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

      {/* Tesla-style status indicators */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="absolute bottom-6 right-6 flex flex-col space-y-2"
      >
        {/* Conversation Status */}
        <motion.div
          className="flex items-center space-x-2 bg-black/50 backdrop-blur-md rounded-lg px-3 py-2 border border-gray-700/30"
          animate={{ opacity: metrics.conversation_active ? 1 : 0.7 }}
        >
          <motion.div
            className={`w-2 h-2 rounded-full ${metrics.conversation_active ? 'bg-green-400' : 'bg-gray-500'}`}
            animate={{
              scale: metrics.conversation_active ? [1, 1.2, 1] : 1,
              opacity: metrics.conversation_active ? [1, 0.7, 1] : 1
            }}
            transition={{
              duration: 2,
              repeat: metrics.conversation_active ? Infinity : 0
            }}
          />
          <span className="text-xs text-gray-400 font-light">
            {metrics.conversation_active ? 'Active' : 'Standby'}
          </span>
        </motion.div>

        {/* Connection Status */}
        <motion.div
          className="flex items-center space-x-2 bg-black/50 backdrop-blur-md rounded-lg px-3 py-2 border border-gray-700/30"
          animate={{ opacity: connected ? 1 : 0.7 }}
        >
          <motion.div
            className={`w-2 h-2 rounded-full ${connected ? 'bg-cyan-400' : 'bg-red-400'}`}
            animate={{
              scale: connected ? [1, 1.2, 1] : 1,
              opacity: connected ? [1, 0.7, 1] : [1, 0.5, 1]
            }}
            transition={{
              duration: connected ? 3 : 1,
              repeat: Infinity
            }}
          />
          <span className="text-xs text-gray-400 font-light">
            {connected ? 'Neural Link' : 'Disconnected'}
          </span>
        </motion.div>
      </motion.div>
    </div>
  );
}
