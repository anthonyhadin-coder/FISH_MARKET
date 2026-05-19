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
import { T as loginT } from '@/lib/i18n';
import api from '@/lib/api';
import { VoiceInput } from '@/components/voice/VoiceInput';
import { ParsedVoiceResult } from '@/lib/voice/voiceParser';
import { User as UserType, ApiError } from '@fishmarket/shared-types';

type RegisterState = 'idle' | 'loading' | 'success' | 'error' | 'offline';
type UserRole = 'AGENT' | 'OWNER' | 'BUYER';

function getFriendlyError(err: ApiError): string {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'You appear to be offline.';
  
  const status = err.response?.status;
  const data = err.response?.data as { message?: string; errors?: Array<{ message: string }> };
  const msg = data?.message || '';

  if (status && status >= 500) return 'Server error. Please try again in a moment.';
  
  // 1. Explicit server message (e.g., "User already exists")
  const safeMsgs = ['User already exists with this phone or email', 'Invalid role selection', 'Invalid phone number format'];
  if (msg && safeMsgs.includes(msg)) return msg;

  // 2. Validation errors
  if (msg === 'Validation failed' && data?.errors) {
    const fieldMessage = data.errors.map((e) => {
      const rawMsg = e.message;
      if (rawMsg.includes('Too small') || rawMsg.includes('8 characters')) {
        return 'Password must be at least 8 characters long';
      }
      return rawMsg;
    }).join('. ');
    return `Registration error: ${fieldMessage}`;
  }

  if (err.message === 'Network Error') return 'Cannot reach the server. Check your connection.';
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

  const { errors, clearAllErrors, formRef, getInputProps } = useFormErrors();
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
      else if (r === 'buyer') router.push('/customer');
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
      setError(getFriendlyError(apiErr));
      
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
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{t.createAccount}</h2>
          </div>
          <button 
            type="button" 
            onClick={handleLangToggle} 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ocean-500 focus:ring-offset-1"
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
          <motion.div className="mb-6 p-3 bg-coral-50 border border-coral-200 rounded-xl flex items-start gap-3 text-coral-700 text-sm font-medium" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <span className="flex-1 mt-0.5">{error || visibleGoogleError}</span>
            <button type="button" onClick={() => { setError(''); clearGoogleError(); }} className="p-1 hover:bg-coral-100 rounded-md transition-colors">
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
            <label className="block text-sm font-semibold text-slate-700 tracking-tight">{t.selectRole}</label>
            <div className="flex p-1 bg-slate-100 rounded-xl shadow-inner">
              <button
                type="button"
                onClick={() => setRole('AGENT')}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${role === 'AGENT' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {t.roleAgent}
              </button>
              <button
                type="button"
                onClick={() => setRole('OWNER')}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${role === 'OWNER' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {t.roleOwner}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700 tracking-tight">{t.fullName}</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-slate-400" />
              </div>
              <input
                {...getInputProps('name')}
                type="text"
                placeholder={currentLang === 'ta' ? 'பெயர்' : 'Enter your name'}
                value={name}
                onChange={e => setName(e.target.value)}
                className={`block w-full h-12 md:h-14 pl-11 pr-4 bg-slate-50 border ${errors.name ? 'border-coral-500 focus:ring-coral-500' : 'border-slate-200 focus:border-ocean-500 focus:ring-ocean-500'} rounded-xl text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-opacity-20 transition-all sm:text-sm`}
              />
            </div>
            {errors.name && <p className="text-xs font-semibold text-coral-600 mt-1">{errors.name}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700 tracking-tight">{t.phoneLabel}</label>
            <div className="flex">
              <div className="flex-none w-14 h-12 md:h-14 border border-r-0 border-slate-200 rounded-l-xl bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600">
                +91
              </div>
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  {...getInputProps('phone')}
                  type="tel"
                  maxLength={10}
                  placeholder="00000 00000"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                  className={`block w-full h-12 md:h-14 pl-10 pr-4 bg-slate-50 border border-l-0 ${errors.phone ? 'border-coral-500 focus:ring-coral-500' : 'border-slate-200 focus:border-ocean-500 focus:ring-ocean-500'} rounded-r-xl text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-opacity-20 transition-all sm:text-sm`}
                />
              </div>
            </div>
            {errors.phone && <p className="text-xs font-semibold text-coral-600 mt-1">{errors.phone}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700 tracking-tight">{t.passwordLabel}</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-400" />
              </div>
              <input
                {...getInputProps('password')}
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className={`block w-full h-12 md:h-14 pl-11 pr-12 bg-slate-50 border ${errors.password ? 'border-coral-500 focus:ring-coral-500' : 'border-slate-200 focus:border-ocean-500 focus:ring-ocean-500'} rounded-xl text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-opacity-20 transition-all sm:text-sm`}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {errors.password && <p className="text-xs font-semibold text-coral-600 mt-1">{errors.password}</p>}
          </div>

          <button
            type="submit"
            disabled={state === 'loading'}
            className={`w-full h-12 md:h-14 mt-4 flex items-center justify-center gap-2 rounded-xl text-sm font-bold uppercase tracking-wider text-white transition-all transform active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ocean-600 shadow-md ${
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
          <div className="h-px bg-slate-200 flex-1"></div>
          <span className="px-4 text-xs font-bold text-slate-400 tracking-wider uppercase">{t.dividerOr}</span>
          <div className="h-px bg-slate-200 flex-1"></div>
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
        <div className="mt-8 text-center text-sm font-medium text-slate-600">
          {t.alreadyHaveAccount}{' '}
          <Link href="/login" className="text-ocean-600 hover:text-ocean-800 font-bold transition-colors inline-flex items-center gap-1 group">
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
      <div className="min-h-[100svh] flex items-center justify-center bg-slate-50">
        <svg className="animate-spin h-10 w-10 text-ocean-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    }>
      <RegisterContent />
    </Suspense>
  );
}
