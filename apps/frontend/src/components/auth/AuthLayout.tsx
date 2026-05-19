import React from 'react';
import { Anchor, ShieldCheck, Globe, Wifi, CheckCircle2 } from 'lucide-react';

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
    <div className="min-h-[100svh] w-full flex flex-col md:flex-row bg-slate-50 overflow-hidden">
      {/* ─────────────────────────────────────────────────────────
          LEFT PANEL - BRANDING (Hidden on small mobile, shown on tablet/desktop)
          ───────────────────────────────────────────────────────── */}
      <div className="hidden md:flex flex-col justify-between w-full md:w-5/12 lg:w-1/2 p-8 lg:p-12 xl:p-16 relative overflow-hidden bg-ocean-950 text-white selection:bg-ocean-500/30">
        {/* Subtle background patterns */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-br from-ocean-900/50 via-ocean-950/80 to-ocean-950 pointer-events-none" />
        
        {/* Top Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-b from-ocean-400 to-ocean-600 shadow-lg shadow-ocean-500/20">
            <Anchor size={24} className="text-white" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">{b.name}</h1>
            <p className="text-sm text-ocean-200 font-medium tracking-wide">{b.sub}</p>
          </div>
        </div>

        {/* Middle Content */}
        <div className="relative z-10 mt-16 lg:mt-0 max-w-lg">
          <h2 className="text-3xl lg:text-4xl xl:text-5xl font-bold leading-tight tracking-tight text-white mb-6">
            Operational precision for the modern market.
          </h2>
          <p className="text-lg text-ocean-100/80 leading-relaxed mb-10">
            {b.tagline}
          </p>

          <ul className="space-y-4">
            {b.features.map((feature, i) => (
              <li key={i} className="flex items-center gap-3 text-ocean-50 font-medium text-sm lg:text-base">
                <CheckCircle2 size={20} className="text-ocean-400 shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom Trust Badges */}
        <div className="relative z-10 flex flex-wrap gap-6 items-center mt-12 pt-8 border-t border-ocean-800/50">
          <div className="flex items-center gap-2 text-ocean-200 text-sm font-medium">
            <ShieldCheck size={18} className="text-ocean-400" />
            <span>{b.secured}</span>
          </div>
          <div className="flex items-center gap-2 text-ocean-200 text-sm font-medium">
            <Globe size={18} className="text-ocean-400" />
            <span>EN / TA Supported</span>
          </div>
          <div className="flex items-center gap-2 text-ocean-200 text-sm font-medium">
            <Wifi size={18} className="text-ocean-400" />
            <span>Offline Ready</span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────
          RIGHT PANEL - AUTH FORM
          ───────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center items-center p-4 sm:p-8 relative overflow-y-auto w-full">
        {/* Mobile Header (Only visible on mobile) */}
        <div className="md:hidden flex items-center justify-center gap-2 mb-8 w-full mt-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-ocean-600 shadow-md">
            <Anchor size={20} className="text-white" />
          </div>
          <span className="text-lg font-bold text-ocean-950 tracking-tight">{b.name}</span>
        </div>

        {/* Main Content Area */}
        <div className="w-full max-w-md mx-auto relative z-10">
          {children}
        </div>
        
        {/* Mobile Footer */}
        <div className="md:hidden mt-8 text-center flex flex-col gap-2 items-center text-xs text-slate-400">
          <div className="flex gap-4">
            <span className="flex items-center gap-1"><ShieldCheck size={14}/> Secure</span>
            <span className="flex items-center gap-1"><Globe size={14}/> EN/TA</span>
          </div>
        </div>
      </div>
    </div>
  );
}
