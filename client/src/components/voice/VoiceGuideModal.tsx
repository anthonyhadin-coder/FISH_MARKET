"use client";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, Mic, X, Check, ArrowRight, Info } from 'lucide-react';
import { ParsedVoiceResult } from '@/lib/voice/voiceParser';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

interface VoiceGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'ta' | 'en';
}

export const VoiceGuideModal: React.FC<VoiceGuideModalProps> = ({ isOpen, onClose, lang }) => {
  const [practiceResult, setPracticeResult] = useState<ParsedVoiceResult[]>([]);

  const { isListening, interimTranscript, startListening, stopListening } = useSpeechRecognition({
    lang: lang,
    onResult: (results) => {
      setPracticeResult(results);
    },
    onError: (err) => {
      console.error("Practice speech error:", err);
    }
  });

  const examples = {
    en: [
      { text: "Thira 20kg rate 40", desc: "Basic sale entry" },
      { text: "Diesel 500", desc: "Expense entry" },
      { text: "Save", desc: "Command to save current row" },
      { text: "Pomfret 10kg rate 200 and Ice 300", desc: "Multi-intent: Sale + Expense" }
    ],
    ta: [
      { text: "திற 20 கிலோ விலை 40", desc: "விற்பனை பதிவு" },
      { text: "டீசல் 500", desc: "செலவு பதிவு" },
      { text: "சேமி", desc: "பதிவு செய்ய" },
      { text: "வாவல் 10 கிலோ மற்றும் ஐஸ் 300", desc: "விற்பனை + செலவு" }
    ]
  };

  const t = {
    en: {
      title: "Voice Assistant Guide",
      subtitle: "Master voice commands in seconds",
      examples: "Try saying:",
      practice: "Practice Mode",
      practiceDesc: "Speak a command to see how it's understood",
      results: "Detection Result:",
      close: "Got it"
    },
    ta: {
      title: "குரல் உதவி வழிகாட்டி",
      subtitle: "குரல் கட்டளைகளை எளிதாகப் பயன்படுத்துங்கள்",
      examples: "இதைச் சொல்ல முயற்சிக்கவும்:",
      practice: "பயிற்சி முறை",
      practiceDesc: "கட்டளையைக் கூறி அது எப்படிப் புரிகிறது என்று பாருங்கள்",
      results: "கண்டறியப்பட்ட முடிவு:",
      close: "சரி"
    }
  }[lang];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-ocean-950/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="voice-dialog-container relative w-full max-w-[92vw] sm:max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-ocean-100 mx-auto"
          >
            {/* Header */}
            <div className="p-6 bg-gradient-to-br from-ocean-600 to-ocean-800 text-white">
              <div className="flex justify-between items-start mb-2">
                <div className="bg-white/20 p-2 rounded-xl">
                  <HelpCircle className="w-6 h-6" />
                </div>
                <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <h2 className="text-2xl font-black tracking-tight">{t.title}</h2>
              <p className="text-ocean-100 text-sm font-medium">{t.subtitle}</p>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Examples Section */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Info className="w-4 h-4 text-ocean-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-ocean-500">{t.examples}</h3>
                </div>
                <div className="grid gap-3">
                  {examples[lang].map((ex, i) => (
                    <div key={i} className="group p-4 bg-ocean-50/50 rounded-2xl border border-ocean-100 hover:border-ocean-300 transition-all">
                      <p className="text-ocean-900 font-bold mb-1 flex items-center gap-2">
                        <span className="text-ocean-400">&quot;</span>
                        {ex.text}
                        <span className="text-ocean-400">&quot;</span>
                      </p>
                      <p className="text-xs text-ocean-500 font-medium">{ex.desc}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Practice Section */}
              <section className="bg-ocean-900 rounded-3xl p-6 text-white shadow-xl">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-black uppercase tracking-widest text-ocean-400">{t.practice}</h3>
                  {isListening && <div className="flex items-center gap-1.5"><span className="w-2 h-2 bg-red-500 rounded-full animate-ping" /><span className="text-[10px] font-bold uppercase">Live</span></div>}
                </div>
                <p className="text-xs text-ocean-200 mb-6">{t.practiceDesc}</p>

                <div className="flex flex-col items-center gap-6">
                  <button 
                    onClick={isListening ? stopListening : startListening}
                    className={`group relative p-6 rounded-full transition-all ${isListening ? 'bg-red-500 scale-110 shadow-lg shadow-red-500/40' : 'bg-ocean-600 hover:bg-ocean-500 shadow-lg shadow-ocean-600/40'}`}
                  >
                    <Mic className={`w-8 h-8 ${isListening ? 'animate-pulse' : ''}`} />
                    {isListening && <motion.div layoutId="pulse" className="absolute -inset-2 border-2 border-red-400 rounded-full animate-ping opacity-50" />}
                  </button>

                  {interimTranscript && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full text-center">
                      <p className="text-lg font-bold italic tracking-tight opacity-90 text-ocean-100">&quot;{interimTranscript}&quot;</p>
                    </motion.div>
                  )}

                  {practiceResult.length > 0 && (
                    <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full pt-4 border-t border-white/10">
                      <p className="text-[10px] font-black uppercase tracking-widest text-ocean-400 mb-3">{t.results}</p>
                      <div className="space-y-2">
                        {practiceResult.map((res: ParsedVoiceResult, i) => (
                          <div key={i} className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                            <div className={`p-1.5 rounded-lg ${res.type === 'SALE' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                              {res.type === 'SALE' ? <Check className="w-3.5 h-3.5" /> : <Info className="w-3.5 h-3.5" />}
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-black uppercase">{res.type}</p>
                              <p className="text-[11px] font-medium text-ocean-200">
                                {res.type === 'SALE' ? `${res.fish || 'Fish'}: ${res.weight}kg @ ₹${res.rate}` : `${res.key}: ₹${res.amount}`}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
              </section>
            </div>

            {/* Actions */}
            <div className="p-6 border-t border-ocean-50 flex justify-end">
              <button 
                onClick={onClose}
                className="px-8 py-3 bg-ocean-100 hover:bg-ocean-200 text-ocean-900 rounded-2xl text-sm font-black transition-all flex items-center gap-2"
              >
                {t.close}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
