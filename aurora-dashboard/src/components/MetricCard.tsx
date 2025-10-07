"use client";

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ReactNode } from 'react';

interface MetricCardProps {
  title: string;
  value: number;
  max: number;
  icon: ReactNode;
  color: string;
  trend: 'up' | 'down' | 'stable';
}

export function MetricCard({ title, value, max, icon, color, trend }: MetricCardProps) {
  const percentage = (value / max) * 100;

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-3 h-3 text-green-400" />;
      case 'down':
        return <TrendingDown className="w-3 h-3 text-red-400" />;
      default:
        return <Minus className="w-3 h-3 text-gray-400" />;
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-green-400';
      case 'down':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -2 }}
      className="bg-black/40 backdrop-blur-md border border-gray-700/50 rounded-xl p-6 relative overflow-hidden group"
    >
      {/* Background gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-5 group-hover:opacity-10 transition-opacity duration-300`} />

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className={`p-2 rounded-lg bg-gradient-to-r ${color} bg-opacity-20`}>
              {icon}
            </div>
            <span className="text-gray-300 text-sm font-medium">{title}</span>
          </div>
          <div className="flex items-center space-x-1">
            {getTrendIcon()}
          </div>
        </div>

        {/* Value */}
        <div className="mb-4">
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-mono font-bold text-white">
              {value.toFixed(1)}
            </span>
            <span className="text-sm text-gray-400">/ {max}</span>
          </div>
          <div className={`text-xs ${getTrendColor()} mt-1`}>
            {trend === 'up' && '+'}
            {trend === 'down' && '-'}
            {percentage.toFixed(1)}%
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative">
          <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
            <motion.div
              className={`h-full bg-gradient-to-r ${color} rounded-full relative`}
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            >
              {/* Animated shine effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                animate={{
                  x: ['-100%', '100%']
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  repeatDelay: 3
                }}
              />
            </motion.div>
          </div>

          {/* Glow effect */}
          <div
            className={`absolute inset-0 bg-gradient-to-r ${color} rounded-full h-2 opacity-30 blur-sm`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Tesla-style data readout */}
        <div className="mt-4 text-xs font-mono text-gray-500 space-y-1">
          <div className="flex justify-between">
            <span>CURR:</span>
            <span className="text-cyan-400">{value.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>PERC:</span>
            <span className="text-cyan-400">{percentage.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between">
            <span>STAT:</span>
            <span className={getTrendColor()}>{trend.toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* Pulse effect for active states */}
      {trend === 'up' && (
        <motion.div
          className={`absolute inset-0 bg-gradient-to-r ${color} opacity-10 rounded-xl`}
          animate={{
            opacity: [0.1, 0.2, 0.1]
          }}
          transition={{
            duration: 2,
            repeat: Infinity
          }}
        />
      )}
    </motion.div>
  );
}