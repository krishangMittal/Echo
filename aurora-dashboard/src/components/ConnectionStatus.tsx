"use client";

import { motion } from 'framer-motion';
import { Wifi, WifiOff, Loader2, Shield, Database } from 'lucide-react';

interface ConnectionStatusProps {
  connected: boolean;
  loading: boolean;
}

export function ConnectionStatus({ connected, loading }: ConnectionStatusProps) {
  const getStatusColor = () => {
    if (loading) return 'text-yellow-400';
    return connected ? 'text-green-400' : 'text-red-400';
  };

  const getStatusIcon = () => {
    if (loading) return <Loader2 className="w-4 h-4 animate-spin" />;
    return connected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />;
  };

  const getStatusText = () => {
    if (loading) return 'CONNECTING';
    return connected ? 'NEURAL LINK ACTIVE' : 'CONNECTION LOST';
  };

  const getBorderColor = () => {
    if (loading) return 'border-yellow-400/30';
    return connected ? 'border-green-400/30' : 'border-red-400/30';
  };

  const getBgColor = () => {
    if (loading) return 'from-yellow-400/10 to-orange-400/10';
    return connected ? 'from-green-400/10 to-emerald-400/10' : 'from-red-400/10 to-rose-400/10';
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex items-center space-x-4 bg-gradient-to-r ${getBgColor()} backdrop-blur-md border ${getBorderColor()} rounded-xl px-4 py-3`}
    >
      {/* Connection status */}
      <div className="flex items-center space-x-2">
        <motion.div
          animate={{
            scale: connected ? [1, 1.1, 1] : 1,
            rotate: loading ? 360 : 0
          }}
          transition={{
            scale: { duration: 1, repeat: Infinity },
            rotate: { duration: 2, repeat: Infinity, ease: "linear" }
          }}
          className={getStatusColor()}
        >
          {getStatusIcon()}
        </motion.div>
        <div>
          <div className={`text-sm font-mono font-bold ${getStatusColor()}`}>
            {getStatusText()}
          </div>
          <div className="text-xs text-gray-400">
            {connected ? 'localhost:8000' : 'Retrying...'}
          </div>
        </div>
      </div>

      {/* Security indicators */}
      <div className="flex items-center space-x-2 border-l border-gray-700/50 pl-4">
        <motion.div
          animate={{
            opacity: connected ? [0.5, 1, 0.5] : 0.3
          }}
          transition={{ duration: 2, repeat: Infinity }}
          className="flex items-center space-x-1"
        >
          <Shield className="w-3 h-3 text-cyan-400" />
          <span className="text-xs font-mono text-cyan-400">SSL</span>
        </motion.div>

        <motion.div
          animate={{
            opacity: connected ? [0.5, 1, 0.5] : 0.3
          }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
          className="flex items-center space-x-1"
        >
          <Database className="w-3 h-3 text-blue-400" />
          <span className="text-xs font-mono text-blue-400">DB</span>
        </motion.div>
      </div>

      {/* Signal strength indicator */}
      <div className="flex items-center space-x-1">
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className={`w-1 ${connected ? 'bg-green-400' : 'bg-gray-600'}`}
            style={{ height: `${4 + i * 2}px` }}
            animate={{
              opacity: connected ? [0.3, 1, 0.3] : 0.3,
              scaleY: connected ? [0.5, 1, 0.5] : 0.5
            }}
            transition={{
              duration: 1,
              delay: i * 0.1,
              repeat: Infinity
            }}
          />
        ))}
      </div>

      {/* Status pulse */}
      <motion.div
        className={`w-3 h-3 rounded-full ${connected ? 'bg-green-400' : loading ? 'bg-yellow-400' : 'bg-red-400'}`}
        animate={{
          scale: connected ? [1, 1.3, 1] : loading ? [1, 1.2, 1] : 1,
          opacity: connected ? [0.7, 1, 0.7] : loading ? [0.5, 1, 0.5] : 0.5
        }}
        transition={{
          duration: connected ? 1 : loading ? 0.8 : 2,
          repeat: Infinity
        }}
      />
    </motion.div>
  );
}