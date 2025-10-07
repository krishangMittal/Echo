"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Send, Loader2, Volume2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { auroraAPI } from '@/lib/api';

interface SpeechInterfaceProps {
  onSpeechProcessed?: (result: any) => void;
  userId?: string;
}

export function SpeechInterface({ onSpeechProcessed, userId = 'default_user' }: SpeechInterfaceProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [speechHistory, setSpeechHistory] = useState<Array<{
    text: string;
    timestamp: Date;
    type: 'user' | 'system';
  }>>([]);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();

      if (recognitionRef.current) {
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onresult = (event) => {
          let finalTranscript = '';
          let interimTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          setTranscript(finalTranscript + interimTranscript);

          if (finalTranscript) {
            processSpeech(finalTranscript);
          }
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
          stopAudioLevel();
        };

        recognitionRef.current.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
          stopAudioLevel();
        };
      }
    }
  }, []);

  const startAudioLevel = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream);

      microphoneRef.current.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateAudioLevel = () => {
        if (analyserRef.current && isListening) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / bufferLength;
          setAudioLevel(average / 255);
          requestAnimationFrame(updateAudioLevel);
        }
      };

      updateAudioLevel();
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopAudioLevel = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    setAudioLevel(0);
  };

  const startListening = async () => {
    if (recognitionRef.current) {
      setIsListening(true);
      setTranscript('');
      recognitionRef.current.start();
      await startAudioLevel();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    stopAudioLevel();
  };

  const processSpeech = async (text: string) => {
    if (!text.trim() || isProcessing) return;

    setIsProcessing(true);
    setSpeechHistory(prev => [...prev, {
      text,
      timestamp: new Date(),
      type: 'user'
    }]);

    try {
      const result = await auroraAPI.processSpeech(text, userId);
      onSpeechProcessed?.(result);

      setSpeechHistory(prev => [...prev, {
        text: `Analysis: ${result.speech_record.analysis.topic} | ${result.speech_record.analysis.emotion} | Importance: ${result.speech_record.analysis.importance}/10`,
        timestamp: new Date(),
        type: 'system'
      }]);
    } catch (error) {
      console.error('Error processing speech:', error);
      setSpeechHistory(prev => [...prev, {
        text: 'Error processing speech',
        timestamp: new Date(),
        type: 'system'
      }]);
    } finally {
      setIsProcessing(false);
      setTranscript('');
    }
  };

  const sendTextInput = () => {
    if (transcript.trim()) {
      processSpeech(transcript);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-black/30 backdrop-blur-md border border-gray-700/50 rounded-xl p-6 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center space-x-3">
        <div className="p-2 rounded-lg bg-gradient-to-r from-red-500 to-pink-500 bg-opacity-20">
          <Mic className="w-5 h-5 text-red-400" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-white">Speech Interface</h3>
          <p className="text-sm text-gray-400">Talk to Aurora in real-time</p>
        </div>
      </div>

      {/* Speech input area */}
      <div className="space-y-4">
        {/* Audio visualizer */}
        <div className="flex items-center justify-center h-20 bg-black/40 rounded-lg border border-gray-700/30 relative overflow-hidden">
          {isListening ? (
            <div className="flex items-center space-x-1">
              {Array.from({ length: 20 }, (_, i) => (
                <motion.div
                  key={i}
                  className="w-1 bg-gradient-to-t from-red-500 to-pink-400 rounded-full"
                  animate={{
                    height: [4, 4 + (audioLevel * 30) + Math.random() * 10, 4]
                  }}
                  transition={{
                    duration: 0.2,
                    repeat: Infinity,
                    delay: i * 0.05
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="text-gray-400 text-center">
              <Volume2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Click the microphone to start listening</p>
            </div>
          )}

          {/* Processing overlay */}
          <AnimatePresence>
            {isProcessing && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-cyan-500/20 backdrop-blur-sm flex items-center justify-center"
              >
                <div className="flex items-center space-x-2 text-cyan-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm font-medium">Processing...</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Transcript display */}
        {transcript && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/40 rounded-lg p-3 border border-gray-700/30"
          >
            <p className="text-gray-100">{transcript}</p>
          </motion.div>
        )}

        {/* Controls */}
        <div className="flex items-center space-x-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={isListening ? stopListening : startListening}
            disabled={isProcessing}
            className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all ${
              isListening
                ? 'bg-red-500 border-red-400 text-white shadow-lg shadow-red-500/30'
                : 'bg-black/40 border-gray-600 text-gray-300 hover:border-red-400 hover:text-red-400'
            } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </motion.button>

          <div className="flex-grow">
            <input
              type="text"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendTextInput()}
              placeholder="Or type your message here..."
              className="w-full bg-black/40 border border-gray-700/30 rounded-lg px-4 py-2 text-gray-100 placeholder-gray-400 focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={sendTextInput}
            disabled={!transcript.trim() || isProcessing}
            className={`flex items-center justify-center w-12 h-12 rounded-full transition-all ${
              transcript.trim() && !isProcessing
                ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                : 'bg-black/40 border border-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Send className="w-5 h-5" />
          </motion.button>
        </div>
      </div>

      {/* Speech history */}
      {speechHistory.length > 0 && (
        <div className="space-y-2 max-h-40 overflow-y-auto">
          <h4 className="text-sm font-medium text-gray-400">Recent Activity</h4>
          <div className="space-y-2">
            {speechHistory.slice(-5).map((entry, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`p-2 rounded-lg text-sm ${
                  entry.type === 'user'
                    ? 'bg-blue-500/20 border-l-2 border-blue-400 text-blue-100'
                    : 'bg-gray-500/20 border-l-2 border-gray-400 text-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-xs opacity-70">
                    {entry.type === 'user' ? 'You' : 'Aurora'}
                  </span>
                  <span className="text-xs opacity-50">
                    {entry.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                <p className="mt-1">{entry.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}