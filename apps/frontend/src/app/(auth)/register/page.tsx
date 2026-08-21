"use client";
import { useState, useEffect, useCallback, useTransition, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Globe, Eye, EyeOff, User, Phone, Lock, ArrowRight,
  WifiOff, Check, ChevronDown
} from 'lucide-react';

import AuthLayout from '@/components/auth/AuthLayout';
import AuthCard from '@/components/auth/AuthCard';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import GoogleAuthButton from '../login/_components/GoogleAuthButton';
import RoleSelectModal from '@/components/shared/RoleSelectModal';
import { useFormErrors } from '@/hooks/useFormErrors';
import { ControlledInput } from '@/components/auth/ControlledInput';
import { T as loginT } from '@/lib/i18n';
import api from '@/lib/api';
import { VoiceInput } from '@/components/voice/VoiceInput';
import { ParsedVoiceResult } from '@/lib/voice/voiceParser';
import { User as UserType, ApiError } from '@fishmarket/shared-types';

type RegisterState = 'idle' | 'loading' | 'success' | 'error' | 'offline';
type UserRole = 'AGENT' | 'OWNER' | 'BUYER';

function getFriendlyError(err: ApiError, lang: string = 'en'): string {
  const isTa = lang === 'ta';
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return isTa ? 'நீங்கள் ஆஃப்லைனில் இருக்கிறீர்கள்.' : 'You appear to be offline.';
  }
  
  const status = err.response?.status;
  const data = err.response?.data as { message?: string; errors?: Array<{ message: string }> };
  const msg = data?.message || '';

  if (status && status >= 500) {
    return isTa ? 'சேவையக பிழை. தயவுசெய்து சிறிது நேரத்தில் மீண்டும் முயற்சிக்கவும்.' : 'Server error. Please try again in a moment.';
  }
  
  // 1. Explicit server message (e.g., "User already exists")
  const safeMsgs = ['User already exists with this phone or email', 'Invalid role selection', 'Invalid phone number format'];
  if (msg && safeMsgs.includes(msg)) {
    if (isTa) {
      if (msg === 'User already exists with this phone or email') {
        return 'இந்த தொலைபேசி அல்லது மின்னஞ்சலில் ஏற்கனவே ஒரு பயனர் உள்ளார்.';
      }
      if (msg === 'Invalid role selection') {
        return 'தவறான பாத்திரத் தேர்வு.';
      }
      if (msg === 'Invalid phone number format') {
        return 'தவறான தொலைபேசி எண் வடிவம்.';
      }
    }
    return msg;
  }

  // 2. Validation errors
  if (msg === 'Validation failed' && data?.errors) {
    const fieldMessage = data.errors.map((e) => {
      const rawMsg = e.message;
      if (rawMsg.includes('Too small') || rawMsg.includes('8 characters')) {
        return isTa ? 'கடவுச்சொல் குறைந்தபட்சம் 8 எழுத்துக்கள் கொண்டிருக்க வேண்டும்' : 'Password must be at least 8 characters long';
      }
      return rawMsg;
    }).join('. ');
    return isTa ? `பதிவு பிழை: ${fieldMessage}` : `Registration error: ${fieldMessage}`;
  }

  if (err.message === 'Network Error') {
    return isTa ? 'சேவையகத்தை இணைக்க முடியவில்லை. உங்கள் இணைப்பைச் சரிபார்க்கவும்.' : 'Cannot reach the server. Check your connection.';
  }
  return isTa ? 'பதிவு தோல்வியடைந்தது. மீண்டும் முயற்சிக்கவும்.' : 'Registration failed. Please try again.';
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
    setTimeout(() => {
      setMounted(true);
      if (!navigator.onLine) setState('offline');
    }, 0);
    const onOnline  = () => setState(s => s === 'offline' ? 'idle' : s);
    const onOffline = () => setState('offline');
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const { errors, clearAllErrors, clearError, formRef } = useFormErrors();
  const { lang, setLang } = useLanguage();
  const { user, login, isLoading } = useAuth();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const currentLang = (lang === 'ta' || lang === 'en') ? lang : 'en';
  const t = loginT[currentLang];

  useEffect(() => {
    // Only redirect if we have a confirmed user and aren't still verifying the session.
    if (user && !isLoading) {
      const r = user.role.toLowerCase();
      if (r === 'owner' || r === 'admin') router.push('/owner');
      else if (r === 'agent') router.push('/agent');
      else if (r === 'buyer') router.push('/marketplace');
      else router.push(`/${r}`);
    }
  }, [user, isLoading, router]);

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
      const apiErr = err as ApiError;
      setState('error');
      setError(getFriendlyError(apiErr, currentLang));
      
      const data = apiErr.response?.data as { errors?: Array<{ path: string[]; message: string }> };
      if (data?.errors && Array.isArray(data.errors)) {
        // Dispatch custom event for useFormErrors hook
        const fieldErrors = data.errors.map((e) => ({
          field: e.path[e.path.length - 1], // Usually 'password', 'phone', etc.
          message: e.message
        }));
        
        window.dispatchEvent(new CustomEvent('api:form-errors', { detail: fieldErrors }));
      }
    }
  };

  const handleLangToggle = () => {
    startTransition(() => {
      setLang(lang === 'en' ? 'ta' : 'en');
    });
  };

  return (
    <AuthLayout lang={currentLang}>
      <AuthCard>
        {/* Global success overlay */}
        <AnimatePresence>
          {state === 'success' && (
            <motion.div
              className="absolute inset-0 z-50 bg-white/95 flex flex-col items-center justify-center rounded-2xl backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="w-20 h-20 rounded-full bg-ocean-50 border-4 border-ocean-100 flex items-center justify-center text-ocean-600 mb-6 shadow-sm">
                <Check size={40} strokeWidth={2.5} />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
                {currentLang === 'ta' ? 'நல்வரவு!' : 'Welcome aboard!'}
              </h2>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{t.createAccount}</h2>
          </div>
          <button 
            type="button" 
            onClick={handleLangToggle} 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 rounded-full text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-1"
          >
            <Globe size={14} />
            {t.langToggle}
            <ChevronDown size={12} />
          </button>
        </div>

        {/* Offline banner */}
        {mounted && state === 'offline' && (
          <motion.div className="mb-6 p-3 bg-orange-50 border border-orange-200 rounded-xl flex items-center gap-3 text-orange-700 text-sm font-medium" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <WifiOff size={18} />
            <span>{t.offlineBanner}</span>
          </motion.div>
        )}

        {/* Error banner */}
        {(error || visibleGoogleError) && (
          <motion.div className="mb-6 p-4 bg-coral-900/20 border border-coral-600/40 rounded-xl flex items-start gap-3 text-coral-200 text-sm font-medium" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} role="alert">
            <span className="flex-1 mt-0.5">{error || visibleGoogleError}</span>
            <button type="button" onClick={() => { setError(''); clearGoogleError(); }} className="p-2 hover:bg-coral-600/20 rounded-md transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-coral-500" aria-label="Close error message">
              ✕
            </button>
          </motion.div>
        )}

        {/* Voice Input Integration */}
        <div className="mb-6">
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

        <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-5">
          {/* Role Selection Tabs */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-200 tracking-tight">{t.selectRole}</label>
            <div className="flex p-1 bg-black/20 rounded-lg shadow-inner border border-white/5">
              <button
                type="button"
                onClick={() => setRole('AGENT')}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 ${role === 'AGENT' ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/10' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {t.roleAgent}
              </button>
              <button
                type="button"
                onClick={() => setRole('OWNER')}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 ${role === 'OWNER' ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/10' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {t.roleOwner}
              </button>
            </div>
          </div>

          <ControlledInput
            name="name"
            type="text"
            label={t.fullName}
            icon={User}
            placeholder={currentLang === 'ta' ? 'பெயர்' : 'Enter your name'}
            value={name}
            onChange={e => {
              setName(e.target.value);
              if (errors.name) clearError('name');
            }}
            error={errors.name}
          />

          <ControlledInput
            name="phone"
            type="tel"
            label={t.phoneLabel}
            maxLength={10}
            leftElement={
              <div className="w-14 h-full flex items-center justify-center text-sm font-bold text-slate-300 border-r border-white/10">
                +91
              </div>
            }
            placeholder="00000 00000"
            value={phone}
            onChange={e => {
              setPhone(e.target.value.replace(/\D/g, ''));
              if (errors.phone) clearError('phone');
            }}
            error={errors.phone}
          />

          <ControlledInput
            name="password"
            type={showPass ? 'text' : 'password'}
            label={t.passwordLabel}
            icon={Lock}
            placeholder="••••••••"
            value={password}
            onChange={e => {
              setPassword(e.target.value);
              if (errors.password) clearError('password');
            }}
            error={errors.password}
            rightElement={
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="p-2 text-slate-400 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 rounded"
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />

          <button
            type="submit"
            disabled={state === 'loading'}
            className={`w-full h-12 mt-4 flex items-center justify-center gap-2 rounded-xl text-sm font-bold uppercase tracking-wider text-white transition-all transform active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ocean-600 shadow-md ${
              state === 'loading'
                ? 'bg-ocean-500 shadow-none cursor-wait'
                : 'bg-ocean-600 hover:bg-ocean-700 hover:shadow-lg'
            }`}
          >
            {state === 'loading' ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>{currentLang === 'ta' ? 'உருவாக்குகிறது...' : 'CREATING...'}</span>
              </>
            ) : (
              t.createAccount
            )}
          </button>
        </form>

        {/* OR divider */}
        <div className="flex items-center justify-center my-6">
          <div className="h-px bg-white/10 flex-1"></div>
          <span className="px-4 text-xs font-bold text-slate-500 tracking-wider uppercase">{t.dividerOr}</span>
          <div className="h-px bg-white/10 flex-1"></div>
        </div>

        {/* Google OAuth Wrapper */}
        <div onClick={() => setGoogleClicked(true)} className="w-full">
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

        {/* Sign in link */}
        <div className="mt-8 text-center text-sm font-medium text-slate-400">
          {t.alreadyHaveAccount}{' '}
          <Link href="/login" className="text-cyan-400 hover:text-cyan-300 font-bold transition-colors inline-flex items-center gap-1 group">
            {t.loginBtn}
            <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </AuthCard>

      <RoleSelectModal
        isOpen={needsRoleSelection}
        lang={currentLang}
        userName={newUserName}
        isLoading={googleLoading}
        onSelect={handleRoleSelect}
      />
    </AuthLayout>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[100svh] flex items-center justify-center bg-[radial-gradient(circle_at_top,#0f172a,#020617)]">
        <svg className="animate-spin h-10 w-10 text-cyan-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    }>
      <RegisterContent />
    </Suspense>
  );
}
