"use client";
import React, { useRef, useEffect } from 'react';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { useToast } from '../ui/Toast';
import { G } from '@/app/(dashboard)/staff/SharedUI';
import { VoiceGuideModal } from './VoiceGuideModal';
import { HelpCircle } from 'lucide-react';
import { useState } from 'react';

/**
 * VoiceInput Component
 * Provides real-time audio visualization, haptic feedback, and accessibility prompts.
 */

interface VoiceInputProps {
  lang: 'ta' | 'en';
  onParsedResult: (results: any[]) => void;
  label?: string;
  targetField?: string;
  fishList?: string[];
  buyerList?: string[];
  variant?: 'standard' | 'card-integrated' | 'minimal';
}

export const VoiceInput: React.FC<VoiceInputProps> = ({ 
  lang, 
  onParsedResult, 
  label, 
  targetField, 
  fishList, 
  buyerList,
  variant = 'standard'
}) => {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showGuide, setShowGuide] = useState(false);
  
  const {
    isListening,
    interimTranscript,
    dbLevel,
    isTooNoisy,
    startListening,
    stopListening
  } = useSpeechRecognition({
    lang,
    fishList,
    buyerList,
    onResult: (results) => {
      onParsedResult(results);
      if (results.length > 0) {
        toast(lang === 'ta' ? 'குரல் பதிவு சேமிக்கப்பட்டது' : 'Voice Entry Recorded', 'success');
        if (window.navigator?.vibrate) window.navigator.vibrate([100, 50, 100]);
      }
    },
    onError: (err) => {
      toast(err, 'error');
    },
    onNoiseGate: () => {
      toast(
        lang === 'ta' ? 'சுற்றுப்புற சத்தம் அதிகமாக உள்ளது' : 'Ambient noise is too high',
        'info'
      );
    }
  });

  useEffect(() => {
    if (isListening && window.navigator?.vibrate) {
      window.navigator.vibrate(50);
    }
  }, [isListening]);

  useEffect(() => {
    if (!isListening || !canvasRef.current || variant === 'minimal') return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const bars = 12;
      const barW = (w / bars) - 2;
      for (let i = 0; i < bars; i++) {
        const value = Math.max(4, (dbLevel / 100) * h * (0.5 + Math.random() * 0.5));
        ctx.fillStyle = isTooNoisy ? '#F43F5E' : '#22D3EE';
        ctx.fillRect(i * (barW + 2), h - value, barW, value);
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, [isListening, dbLevel, isTooNoisy, variant]);

  if (variant === 'card-integrated') {
    return (
      <>
        <div style={{ 
          position: 'absolute', 
          top: 16, 
          right: 16, 
          zIndex: 30,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 12
        }}>
          <button
            onClick={isListening ? stopListening : startListening}
            title={isListening ? "Stop" : "Voice Entry"}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              border: `1px solid ${isListening ? 'rgba(244,63,94,0.4)' : 'rgba(34,211,238,0.2)'}`,
              background: isListening ? 'rgba(244,63,94,0.15)' : 'rgba(10,37,64,0.6)',
              backdropFilter: 'blur(12px)',
              color: isListening ? '#F43F5E' : '#22D3EE',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              boxShadow: isListening ? '0 0 20px rgba(244,63,94,0.3)' : '0 4px 12px rgba(0,0,0,0.2)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              animation: isListening ? 'vpulse 1.2s infinite' : 'none',
            }}
          >
            {isListening ? '⏹' : '🎤'}
          </button>

          {isListening && (
            <div style={{ 
              background: 'rgba(10, 37, 64, 0.9)', 
              padding: '12px 16px', 
              borderRadius: '16px', 
              border: '1px solid rgba(34,211,238,0.2)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
              width: 240,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              animation: 'slideIn 0.3s ease-out'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#22D3EE', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {lang === 'ta' ? 'குரல் உள்ளீடு' : 'Voice Entry'}
                </span>
                <canvas ref={canvasRef} width={60} height={14} />
              </div>
              <div style={{ fontSize: 13, color: '#F0F9FF', fontStyle: interimTranscript ? 'italic' : 'normal', fontWeight: 500 }}>
                {interimTranscript ? `"${interimTranscript}"` : (lang === 'ta' ? 'பேசவும்...' : 'Listening...')}
              </div>
            </div>
          )}
        </div>
        <VoiceGuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} lang={lang} />
      </>
    );
  }

  if (variant === 'minimal') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          onClick={isListening ? stopListening : startListening}
          title={isListening ? "Stop" : (lang === 'ta' ? "குரல் உள்ளீடு" : "Voice Entry")}
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            border: 'none',
            background: isListening ? '#F43F5E' : 'rgba(34,211,238,0.1)',
            color: isListening ? 'white' : '#22D3EE',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            transition: 'all 0.2s',
            animation: isListening ? 'vpulse 1.2s infinite' : 'none'
          }}
        >
          {isListening ? '⏹' : '🎤'}
        </button>
        {isListening && (
           <div style={{ 
             fontSize: 10, 
             color: isTooNoisy ? '#F43F5E' : '#22D3EE', 
             fontWeight: 700,
             animation: 'pulse 1s infinite'
           }}>
             {lang === 'ta' ? 'கேட்கிறது' : 'Listening'}
           </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 300 }}>
      {label && <label style={{ fontSize: 13, fontWeight: 700, color: G.muted }}>{label}</label>}
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={isListening ? stopListening : startListening}
          aria-label={isListening ? "Stop listening" : "Start voice entry"}
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            border: 'none',
            background: isListening ? G.red : G.accent,
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
            animation: isListening ? 'vpulse 1.2s infinite' : 'none',
            transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}
        >
          {isListening ? '⏹' : '🎤'}
        </button>

        <button
          onClick={() => { stopListening(); setShowGuide(true); }}
          title={lang === 'ta' ? 'உதவி' : 'Help'}
          style={{
            width: 36,
            height: 36,
            borderRadius: '12px',
            border: `1px solid ${G.border}`,
            background: G.card,
            color: G.accent,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}
        >
          <HelpCircle size={18} />
        </button>

        {isListening && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <canvas ref={canvasRef} width={80} height={20} />
            <div
              aria-live="polite"
              style={{
                fontSize: 12,
                color: isTooNoisy ? G.red : G.green,
                fontWeight: 600
              }}
            >
              {isTooNoisy 
                ? (lang === 'ta' ? 'சத்தம் அதிகமாக உள்ளது' : 'Too noisy') 
                : (lang === 'ta' ? 'கேட்கிறேன்...' : 'Listening...')}
            </div>
          </div>
        )}
      </div>

      {interimTranscript && (
        <div 
           style={{ 
             fontSize: 14, 
             color: G.text, 
             background: G.card, 
             padding: '8px 12px', 
             borderRadius: 8,
             border: `1px solid ${G.border}`,
             fontStyle: 'italic'
           }}
        >
          "{interimTranscript}"
        </div>
      )}

      <VoiceGuideModal 
        isOpen={showGuide} 
        onClose={() => setShowGuide(false)} 
        lang={lang} 
      />
    </div>
  );
};
