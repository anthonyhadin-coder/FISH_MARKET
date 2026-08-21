import React from 'react';
import { Anchor, ShieldCheck, Globe } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
  lang?: 'en' | 'ta';
}

const BRAND = {
  en: {
    name: 'DEEP OCEAN',
    sub: 'Fish Market',
    tagline: 'Secure access to maritime catch records, fleet logistics, and high-frequency trading terminals.',
    features: [
      'End-to-end encrypted transactions',
      'Real-time fleet tracking & analytics',
      'Instant settlement & payouts',
      'Offline-ready mobile operations'
    ],
    secured: 'Enterprise-grade security'
  },
  ta: {
    name: 'ஆழ் கடல்',
    sub: 'மீன் சந்தை',
    tagline: 'கப்பல் பதிவேடுகள், தளவாட மேலாண்மை மற்றும் வர்த்தக முனையங்களுக்கான பாதுகாப்பான அணுகல்.',
    features: [
      'பாதுகாப்பான பரிவர்த்தனைகள்',
      'நிகழ்நேர படகு கண்காணிப்பு',
      'உடனடி நிதி தீர்வுகள்',
      'ஆஃப்லைன் ஆதரவுடன் செயல்படும்'
    ],
    secured: 'நிறுவன தர பாதுகாப்பு'
  }
};

export default function AuthLayout({ children, lang = 'en' }: AuthLayoutProps) {
  const b = BRAND[lang];

  return (
    <div className="min-h-[100svh] w-full flex flex-col justify-center items-center bg-[radial-gradient(circle_at_top,#0f172a,#020617)] relative overflow-y-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Subtle grid/grain decoration */}
      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] pointer-events-none mix-blend-overlay" />
      <div className="absolute inset-0 bg-gradient-to-b from-ocean-900/10 to-transparent pointer-events-none" />
      
      {/* Header */}
      <div className="flex flex-col items-center justify-center gap-3 mb-8 sm:mb-10 relative z-10">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-ocean-500 to-ocean-700 shadow-lg shadow-ocean-900/50 border border-ocean-400/20">
          <Anchor size={24} className="text-white" />
        </div>
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">{b.name}</h1>
          <p className="text-xs text-ocean-200/70 font-semibold tracking-[0.2em] uppercase mt-1">{b.sub}</p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="w-full max-w-md mx-auto relative z-10">
        {children}
      </div>
      
      {/* Footer */}
      <div className="mt-10 sm:mt-12 text-center flex flex-col gap-2 items-center text-xs sm:text-xs font-medium text-slate-500 relative z-10">
        <div className="flex gap-4">
          <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-emerald-500/80 flex-shrink-0" /> {b.secured}</span>
          <span className="flex items-center gap-1.5"><Globe size={14} className="text-ocean-500/80 flex-shrink-0" /> EN / TA Supported</span>
        </div>
      </div>
    </div>
  );
}
