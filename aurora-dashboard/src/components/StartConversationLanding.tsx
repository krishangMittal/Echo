"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Sparkles, Brain, Zap, User, Settings } from 'lucide-react';

interface StartConversationLandingProps {
  onConversationStart?: (conversationData: any) => void;
  userId?: string;
}

interface ConversationResult {
  conversation_id: string;
  conversation_url: string;
  persona_id: string;
  status: string;
}

export function StartConversationLanding({ onConversationStart, userId = 'default_user' }: StartConversationLandingProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastConversation, setLastConversation] = useState<ConversationResult | null>(null);
  const [userName, setUserName] = useState('');
  const [customUserId, setCustomUserId] = useState(userId);

  const createNewConversation = async () => {
    setIsCreating(true);
    setError(null);

    try {
      console.log('🚀 Creating new Aurora conversation...');

      // Use the new endpoint that supports custom user names
      const response = await fetch('http://localhost:8000/api/create-conversation-with-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: customUserId,
          user_name: userName || undefined
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ConversationResult = await response.json();

      console.log('✅ Conversation created:', result);
      setLastConversation(result);

      // Notify parent component with additional user data
      if (onConversationStart) {
        const conversationData = {
          ...result,
          user_id: customUserId,
          user_name: userName || undefined
        };
        console.log('📞 Calling onConversationStart with:', conversationData);
        onConversationStart(conversationData);
      }

      return result;

    } catch (error) {
      console.error('❌ Failed to create conversation:', error);
      setError(`Failed to create conversation: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="w-full h-full flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center space-y-12"
      >
        {/* Minimalist Header */}
        <div className="space-y-6">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="w-32 h-32 mx-auto rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 flex items-center justify-center shadow-2xl shadow-cyan-500/30"
          >
            <Brain className="w-16 h-16 text-white" />
          </motion.div>

          <div>
            <h1 className="text-5xl font-extralight tracking-wider text-white mb-3">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500">AURORA</span>
            </h1>
            <p className="text-lg text-gray-400/80 font-light tracking-wide">
              Neural Interface • Ready to Connect
            </p>
          </div>
        </div>

        {/* User Input Fields */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="space-y-4 w-full max-w-md"
        >
          <div className="space-y-3">
            <label className="block text-sm font-light text-gray-400">
              User ID
            </label>
            <input
              type="text"
              value={customUserId}
              onChange={(e) => setCustomUserId(e.target.value)}
              placeholder="Enter user ID"
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20"
            />
          </div>
          
          <div className="space-y-3">
            <label className="block text-sm font-light text-gray-400">
              Display Name (Optional)
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20"
            />
          </div>
        </motion.div>

        {/* Single Action Button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="space-y-8"
        >
          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={createNewConversation}
            disabled={isCreating}
            className={`relative px-12 py-6 rounded-2xl font-light text-xl transition-all duration-500 ${
              isCreating
                ? 'bg-gray-800/50 text-gray-500 cursor-not-allowed border border-gray-700/30'
                : 'bg-gradient-to-r from-cyan-500/90 via-blue-500/90 to-purple-500/90 text-white shadow-2xl shadow-cyan-500/40 hover:shadow-cyan-500/60 border border-cyan-400/30 backdrop-blur-sm'
            }`}
          >
            <div className="flex items-center space-x-4">
              {isCreating ? (
                <>
                  <div className="w-8 h-8 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                  <span>Initializing Neural Link...</span>
                </>
              ) : (
                <>
                  <MessageCircle className="w-8 h-8" />
                  <span>Begin Conversation</span>
                </>
              )}
            </div>

            {/* Tesla-style button glow effect */}
            {!isCreating && (
              <motion.div
                className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-400/20 via-blue-500/20 to-purple-500/20"
                animate={{
                  opacity: [0, 0.3, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            )}
          </motion.button>

          {/* Subtle session info */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="flex items-center justify-center space-x-2 text-gray-500 text-sm font-light"
          >
            <User className="w-4 h-4" />
            <span>{userName || customUserId}</span>
          </motion.div>
        </motion.div>

        {/* Error Display */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm backdrop-blur-md"
          >
            <div className="font-medium">Neural Link Error</div>
            <div className="text-gray-400 mt-1">{error}</div>
          </motion.div>
        )}

        {/* Success Display */}
        {lastConversation && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-green-900/20 border border-green-500/30 rounded-xl p-4 text-green-400 text-sm backdrop-blur-md"
          >
            <div className="font-medium">Neural Link Established</div>
            <div className="text-gray-400 mt-1 font-mono text-xs">
              Session: {lastConversation.conversation_id}
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}