"use client";
import { useState, useEffect, useCallback, useTransition, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Globe, Eye, EyeOff, User, Phone, Lock, Ship, ArrowRight,
  WifiOff, Check, ChevronDown, ShieldCheck
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import GoogleAuthButton from '../login/_components/GoogleAuthButton';
import RoleSelectModal from '@/components/shared/RoleSelectModal';
import { useFormErrors } from '@/hooks/useFormErrors';
import { loginT } from '@/lib/loginTranslations';
import api from '@/lib/api';
// We import the new unified design system
import '../login/login-light.css';
import { VoiceInput } from '@/components/voice/VoiceInput';
import { ParsedVoiceResult } from '@/lib/voice/voiceParser';
import { User as UserType, ApiError } from '@/lib/types';

type RegisterState = 'idle' | 'loading' | 'success' | 'error' | 'offline';
type UserRole = 'AGENT' | 'OWNER' | 'BUYER';

function getFriendlyError(err: ApiError): string {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'You appear to be offline.';
  const msg = err.response?.data?.message || '';
  if (err.message === 'Network Error') return 'Cannot reach the server. Check your connection.';
  if (msg) return msg;
  return 'Registration failed. Please try again.';
}

function RegisterContent() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('AGENT');
  const [showPass, setShowPass] = useState(false);
  
  const [state, setState] = useState<RegisterState>('idle');
  const [error, setError] = useState('');
  const [googleClicked, setGoogleClicked] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!navigator.onLine) setState('offline');
    const onOnline  = () => setState(s => s === 'offline' ? 'idle' : s);
    const onOffline = () => setState('offline');
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const { errors, clearAllErrors, formRef, getInputProps } = useFormErrors();
  const { lang, setLang } = useLanguage();
  const { user, login } = useAuth();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const currentLang = (lang === 'ta' || lang === 'en') ? lang : 'en';
  const t = loginT[currentLang];

  useEffect(() => {
    if (user) {
      const r = user.role.toLowerCase();
      if (r === 'owner' || r === 'admin') router.push('/owner');
      else if (r === 'agent') router.push('/staff');
      else if (r === 'buyer') router.push('/customer');
      else router.push(`/${r}`);
    }
  }, [user, router]);

  const {
    isLoading: googleLoading,
    error: googleError,
    popupBlocked,
    needsRoleSelection,
    newUserName,
    handleGoogleSuccess,
    handleGoogleError,
    handleRoleSelect,
    clearError: clearGoogleError,
  } = useGoogleAuth();

  const visibleGoogleError = googleClicked ? googleError : null;

  const handleSuccessFlash = useCallback(async (userData: UserType) => {
    setState('success');
    await new Promise(r => setTimeout(r, 1400));
    login(userData);
  }, [login]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === 'loading') return;

    setState('loading');
    setError('');
    clearAllErrors();

    try {
      const res = await api.post('/auth/register', {
        name,
        phone,
        password,
        role: role.toUpperCase(),
      });
      await handleSuccessFlash(res.data.user);
    } catch (err: unknown) {
      setState('error');
      setError(getFriendlyError(err as ApiError));
    }
  };

  const handleLangToggle = () => {
    startTransition(() => {
      setLang(lang === 'en' ? 'ta' : 'en');
    });
  };

  return (
    <div className="login-light-content">
      {/* ── Brand & Lang ─────────────────────────────────────────── */}
      <div className="flex flex-col items-center mb-8">
        <button
          type="button"
          onClick={handleLangToggle}
          className="absolute top-4 right-4 ll-lang-btn z-50"
          aria-label="Toggle language"
        >
          <Globe className="w-3.5 h-3.5 text-blue-600" />
          {t.langToggle}
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </button>

        <div className="ll-brand-icon mb-4">
          <Ship className="w-7 h-7" />
        </div>
        <h1 className="ll-brand-name">
          {currentLang === 'ta' ? 'ஆழ் கடல்' : 'DEEP OCEAN'}
        </h1>
        <h2 className="ll-brand-sub mb-1">
          {currentLang === 'ta' ? 'சந்தை' : 'MARKET'}
        </h2>
        <p className="ll-brand-tag">
          {currentLang === 'ta' ? 'எளிமையானது. மீனவர்களுக்காக.' : 'Smart. Simple. Built for Fishermen.'}
        </p>
      </div>

      {/* ── Main form block ──────────────────────────────────────── */}
      <div className="ll-card">

        {/* Banners */}
        {mounted && state === 'offline' && (
          <motion.div
            className="ll-offline-banner"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <WifiOff className="w-4 h-4" />
            <span>{t.offlineBanner}</span>
          </motion.div>
        )}

        {(error || visibleGoogleError) && (
          <div className="ll-error-banner">
            <span className="flex-1">{error || visibleGoogleError}</span>
            <button type="button" onClick={() => { setError(''); clearGoogleError(); }}>✕</button>
          </div>
        )}

        <h2 className="text-[17px] font-black text-slate-800 mb-5 leading-tight uppercase tracking-wide">
          {t.createAccount}
        </h2>

        {/* Voice Input Integration */}
        <div className="mb-5">
          <VoiceInput
            variant="card-integrated"
            lang={currentLang}
            onParsedResult={(res: ParsedVoiceResult[]) => {
              res.forEach(item => {
                if (item.command === 'save') {
                  const btn = document.querySelector('button[type="submit"]') as HTMLButtonElement;
                  btn?.click();
                }
              });
            }}
          />
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4" noValidate>

          {/* Role Selection Tabs */}
          <div>
            <label className="ll-label">{t.selectRole}</label>
            <div className="ll-tabs">
              <button
                type="button"
                onClick={() => setRole('AGENT')}
                className={`ll-tab ${role === 'AGENT' ? 'active' : ''}`}
              >
                {t.roleAgent}
              </button>
              <button
                type="button"
                onClick={() => setRole('OWNER')}
                className={`ll-tab ${role === 'OWNER' ? 'active' : ''}`}
              >
                {t.roleOwner}
              </button>
            </div>
          </div>

          <div>
            <label className="ll-label">{t.fullName}</label>
            <div className="relative">
              <User className="ll-input-icon" />
              <input
                {...getInputProps('name')}
                type="text"
                placeholder={currentLang === 'ta' ? 'பெயர்' : 'Enter your name'}
                value={name}
                onChange={e => setName(e.target.value)}
                className={`ll-input ${errors.name ? 'error' : ''}`}
              />
            </div>
            {errors.name && <p className="text-[11px] text-red-500 font-bold mt-1.5">{errors.name}</p>}
          </div>

          <div>
            <label className="ll-label">{t.phoneLabel}</label>
            <div className="relative flex">
              <div className="flex-none w-14 border border-r-0 border-slate-200 rounded-l-lg bg-slate-50 flex items-center justify-center text-sm font-bold text-slate-600">
                +91
              </div>
              <div className="relative flex-1">
                <Phone className="ll-input-icon !left-3" />
                <input
                  {...getInputProps('phone')}
                  type="tel"
                  maxLength={10}
                  placeholder="00000 00000"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                  className={`ll-input !rounded-l-none !pl-10 ${errors.phone ? 'error' : ''}`}
                />
              </div>
            </div>
            {errors.phone && <p className="text-[11px] text-red-500 font-bold mt-1.5">{errors.phone}</p>}
          </div>

          <div>
            <label className="ll-label">{t.passwordLabel}</label>
            <div className="relative">
              <Lock className="ll-input-icon" />
              <input
                {...getInputProps('password')}
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className={`ll-input ${errors.password ? 'error' : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showPass ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
              </button>
            </div>
            {errors.password && <p className="text-[11px] text-red-500 font-bold mt-1.5">{errors.password}</p>}
          </div>

          <button
            type="submit"
            disabled={state === 'loading'}
            className="ll-submit-btn"
          >
            {state === 'loading' ? (
              <>
                <div className="ll-wave-bars">
                  {[1,2,3,4,5].map(i => <span key={i} />)}
                </div>
                <span className="uppercase tracking-widest font-black text-sm">
                  {currentLang === 'ta' ? 'உருவாக்குகிறது...' : 'CREATING...'}
                </span>
              </>
            ) : t.createAccount}
          </button>
        </form>

        <div className="ll-divider">
          <span>{t.dividerOr}</span>
        </div>

        <div className="mt-5">
          <GoogleAuthButton
            lang={currentLang}
            isLoading={googleLoading}
            isOffline={mounted ? state === 'offline' : false}
            popupBlocked={popupBlocked}
            onSuccess={(credential) => {
              setGoogleClicked(true);
              handleGoogleSuccess(credential);
            }}
            onError={() => {
              if (googleClicked) handleGoogleError();
            }}
          />
        </div>

        <AnimatePresence>
          {state === 'success' && (
            <motion.div
              className="ll-success-overlay"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="w-16 h-16 bg-green-50 border border-green-200 text-green-500 rounded-full flex items-center justify-center">
                <Check className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">
                {currentLang === 'ta' ? 'நல்வரவு!' : 'Welcome aboard!'}
              </h3>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-center gap-2 mt-5 text-[11px] text-slate-400 font-medium">
          <ShieldCheck className="w-3.5 h-3.5" />
          {t.securedBy}
        </div>
      </div>

      <div className="ll-bottom-link">
        {t.alreadyHaveAccount}{' '}
        <Link href="/login">
          {t.loginBtn} <ArrowRight className="w-3 h-3 inline" />
        </Link>
      </div>

      <RoleSelectModal
        isOpen={needsRoleSelection}
        lang={currentLang}
        userName={newUserName}
        isLoading={googleLoading}
        onSelect={handleRoleSelect}
      />
    </div>
  );
}

export default function RegisterPage() {
  return (
    <main className="login-light-layout">
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="ll-wave-bars">
            {[1,2,3,4,5].map(i => <span key={i} style={{background:'#1D6AE5'}} />)}
          </div>
        </div>
      }>
        <RegisterContent />
      </Suspense>
    </main>
  );
}
