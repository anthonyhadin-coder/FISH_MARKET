"use client";
import { useState, useEffect, useCallback, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe, Eye, EyeOff, User, Phone, Lock, Ship, ArrowRight,
  WifiOff, CloudOff, ShieldCheck, Zap, ChevronDown, Check
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import GoogleAuthButton from '../login/_components/GoogleAuthButton';
import RoleSelectModal from '@/components/shared/RoleSelectModal';
import { useFormErrors } from '@/hooks/useFormErrors';
import { loginT } from '@/lib/loginTranslations';
import api from '@/lib/api';
import './register.css';
import { VoiceInput } from '@/components/voice/VoiceInput';
import { ParsedVoiceResult } from '@/lib/voice/voiceParser';
import { User as UserType } from '@/lib/types';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ApiError } from '@/lib/types';

type RegisterState = 'idle' | 'loading' | 'success' | 'error';
type UserRole = 'AGENT' | 'OWNER' | 'BUYER';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('AGENT');
  const [showPass, setShowPass] = useState(false);
  const [state, setState] = useState<RegisterState>('idle');
  const [error, setError] = useState('');
  // Guard: only show Google errors if the user has actually clicked the Google button
  const [googleClicked, setGoogleClicked] = useState(false);

  // ── HYDRATION FIX: never read browser APIs during SSR ─────────
  // Start as false / unmounted; update only after client hydrates.
  const [mounted, setMounted] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Now we're safely on the client — read the real online status
    setMounted(true);
    setIsOffline(!navigator.onLine);

    const onOnline  = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
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

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      const r = user.role.toLowerCase();
      if (r === 'owner' || r === 'admin') router.push('/owner');
      else if (r === 'agent') router.push('/staff');
      else if (r === 'buyer') router.push('/customer');
      else router.push(`/${r}`);
    }
  }, [user, router]);

  // Google OAuth hook
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

  // Only surface Google errors if the user actually initiated the flow
  const visibleGoogleError = googleClicked ? googleError : null;

  const handleSuccessFlash = useCallback(async (userData: UserType) => {
    setState('success');
    await new Promise(r => setTimeout(r, 1400));
    login(userData);
  }, [login]);

  // ── Form submit → POST /auth/register ──────────────────────────
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
      setError(apiErr.response?.data?.message || 'Registration failed. Please try again.');
    }
  };

  // Lang toggle handler — deferred so it doesn't conflict with router init
  const handleLangToggle = () => {
    startTransition(() => {
      setLang(lang === 'en' ? 'ta' : 'en');
    });
  };

  return (
    <main className="register-layout">
      <div className="register-content">

        {/* ── Header ───────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-6">
          <div className="brand-logo-container">
            <div className="brand-icon">
              <Ship className="w-8 h-8" />
            </div>
            <div>
              <div className="brand-text-main">
                {currentLang === 'ta' ? 'ஆழ் கடல்' : 'DEEP OCEAN'}
              </div>
              <div className="brand-text-sub">
                {currentLang === 'ta' ? 'மீன் சந்தை' : 'FISH MARKET'}
              </div>
              <div className="brand-slogan">
                {currentLang === 'ta'
                  ? 'எளிமையானது. மீனவர்களுக்காக.'
                  : 'Smart. Simple. Built for Fishermen.'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLangToggle}
            className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-full px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm"
            aria-label="Toggle language"
          >
            <Globe className="w-4 h-4 text-blue-600" />
            {t.langToggle}
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
        </div>

        {/* ── OR divider ────────────────────────────────────── */}
        <div className="or-divider">
          <span>{t.dividerOr}</span>
        </div>

        {/* ── Role selection ────────────────────────────────── */}
        <h2 className="text-[15px] font-bold text-slate-900 mb-3">
          {t.selectRole}
        </h2>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Boat Agent */}
          <button
            type="button"
            onClick={() => setRole('AGENT')}
            className={`role-btn ${role === 'AGENT' ? 'active' : ''}`}
          >
            {role === 'AGENT' && (
              <div className="role-check"><Check className="w-3 h-3" /></div>
            )}
            <div className="role-icon">
              <User className="w-6 h-6" />
            </div>
            <div>
              <div className="role-title">{t.roleAgent.toUpperCase()}</div>
              <div className="role-desc">{t.roleAgentDesc}</div>
            </div>
          </button>

          {/* Market Owner */}
          <button
            type="button"
            onClick={() => setRole('OWNER')}
            className={`role-btn ${role === 'OWNER' ? 'active' : ''}`}
          >
            {role === 'OWNER' && (
              <div className="role-check"><Check className="w-3 h-3" /></div>
            )}
            <div className="role-icon">
              <Ship className="w-6 h-6" />
            </div>
            <div>
              <div className="role-title">{t.roleOwner.toUpperCase()}</div>
              <div className="role-desc">{t.roleOwnerDesc}</div>
            </div>
          </button>
        </div>

        {/* ── Form card ─────────────────────────────────────── */}
        <div className="register-card relative">

          {/* Voice command — triggers form submit on "save" */}
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

          {/* Success overlay */}
          <AnimatePresence>
            {state === 'success' && (
              <motion.div
                className="absolute inset-0 bg-white/95 rounded-xl z-50 flex flex-col items-center justify-center gap-3"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <div className="w-16 h-16 bg-blue-50 border border-blue-200 text-blue-600 rounded-full flex items-center justify-center">
                  <Check className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">
                  {currentLang === 'ta' ? 'கணக்கு உருவாக்கப்பட்டது!' : 'Account Created!'}
                </h3>
                <p className="text-sm font-medium text-slate-500">{t.redirecting}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Offline banner — gated by mounted AND isOffline (no AnimatePresence wrapper)
              AnimatePresence caused Framer Motion to SSR-render the initial animation
              state even when the condition was false, producing a hydration mismatch.
              This matches the same pattern used in login/page.tsx. */}
          {mounted && isOffline && (
            <motion.div
              className="flex items-center gap-2 p-3 text-sm font-semibold mb-4 bg-blue-50 text-blue-600 rounded-lg border border-blue-100"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <WifiOff className="w-4 h-4" />
              <span>{t.offlineBanner}</span>
            </motion.div>
          )}

          {/* Error banner */}
          {(error || visibleGoogleError) && (
            <div className="flex items-center gap-3 p-3 text-sm font-semibold mb-4 bg-red-50 text-red-500 rounded-lg border border-red-100">
              <span className="flex-1">{error || visibleGoogleError}</span>
              <button type="button" onClick={() => { setError(''); clearGoogleError(); }}>✕</button>
            </div>
          )}

          {/* ── Registration form ─────────────────────────── */}
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4" noValidate>

            {/* Full Name */}
            <div>
              <label htmlFor="name" className="reg-label">
                {currentLang === 'ta' ? 'முழு பெயர்' : 'FULL NAME'}
              </label>
              <div className="relative">
                <User className="input-icon-left" />
                <input
                  type="text"
                  autoComplete="name"
                  placeholder={t.fullNamePlaceholder}
                  value={name}
                  {...getInputProps('name')}
                  onChange={e => {
                    setName(e.target.value);
                    getInputProps('name').onChange();
                  }}
                  className={`reg-input ${errors.name ? 'border-red-400' : ''}`}
                  required
                  minLength={2}
                />
              </div>
              {errors.name && (
                <p className="text-xs text-red-500 mt-1 font-medium">{errors.name}</p>
              )}
            </div>

            {/* Phone Number */}
            <div>
              <label htmlFor="phone" className="reg-label">
                {currentLang === 'ta' ? 'கைபேசி எண்' : 'PHONE NUMBER'}
              </label>
              <div className="relative">
                <Phone className="input-icon-left" />
                <input
                  type="tel"
                  autoComplete="tel"
                  placeholder={t.phonePlaceholder}
                  value={phone}
                  {...getInputProps('phone')}
                  onChange={e => {
                    setPhone(e.target.value.replace(/[^\d+\-\s()]/g, ''));
                    getInputProps('phone').onChange();
                  }}
                  className={`reg-input pr-20 ${errors.phone ? 'border-red-400' : ''}`}
                  required
                />
                {/* +91 badge */}
                <div className="absolute right-0 top-0 h-full flex items-center px-3 text-slate-600 font-semibold text-sm border-l border-slate-200 pointer-events-none">
                  +91 <ChevronDown className="w-3 h-3 ml-1 text-slate-400" />
                </div>
              </div>
              {errors.phone && (
                <p className="text-xs text-red-500 mt-1 font-medium">{errors.phone}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="reg-label">
                {currentLang === 'ta' ? 'கடவுச்சொல்' : 'PASSWORD'}
              </label>
              <div className="relative">
                <Lock className="input-icon-left" />
                <input
                  type={showPass ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder={
                    currentLang === 'ta'
                      ? 'வலிமையான கடவுச்சொல் உருவாக்கவும்'
                      : 'Create a strong password'
                  }
                  value={password}
                  {...getInputProps('password')}
                  onChange={e => {
                    setPassword(e.target.value);
                    getInputProps('password').onChange();
                  }}
                  className={`reg-input pr-12 ${errors.password ? 'border-red-400' : ''}`}
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password ? (
                <p className="text-xs text-red-500 mt-1 font-medium">{errors.password}</p>
              ) : (
                <div className="pass-hint">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {currentLang === 'ta'
                    ? 'குறைந்தது 8 எழுத்துக்கள் தேவை'
                    : 'Use at least 8 characters with letters and numbers'}
                </div>
              )}
            </div>

            {/* CREATE ACCOUNT button */}
            <button
              id="register-submit-btn"
              type="submit"
              disabled={state === 'loading'}
              className="reg-submit-btn"
            >
              {state === 'loading' ? (
                <span className="font-semibold tracking-wide animate-pulse">
                  {currentLang === 'ta' ? 'உருவாக்குகிறது…' : 'CREATING ACCOUNT…'}
                </span>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4" />
                  {t.registerBtn.toUpperCase()}
                </>
              )}
            </button>

            {/* OR CONTINUE WITH */}
            <div className="or-divider">
              <span>
                {currentLang === 'ta' ? 'அல்லது இதன் மூலம் தொடரவும்' : 'OR CONTINUE WITH'}
              </span>
            </div>

            {/* Google OAuth — real button with popup/redirect detection */}
            <div
              className="w-full flex justify-center"
              onClick={() => setGoogleClicked(true)}
            >
              <GoogleAuthButton
                lang={currentLang}
                isLoading={googleLoading}
                isOffline={mounted ? isOffline : false}
                popupBlocked={popupBlocked}
                onSuccess={(credential) => {
                  setGoogleClicked(true);
                  handleGoogleSuccess(credential);
                }}
                onError={() => {
                  // Only surface the error if user deliberately clicked
                  if (googleClicked) handleGoogleError();
                }}
              />
            </div>

          </form>

          {/* ── Feature badges ────────────────────────────── */}
          <div className="features-grid">
            <div className="feature-item">
              <div className="feature-icon"><CloudOff className="w-4 h-4" /></div>
              <div>
                <div className="feature-title">
                  {currentLang === 'ta' ? 'ஆஃப்லைன் பயன்பாடு' : 'Works Offline'}
                </div>
                <div className="feature-sub">
                  {currentLang === 'ta' ? 'இணையம் இல்லாமல்' : 'No internet? No problem.'}
                </div>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon"><ShieldCheck className="w-4 h-4" /></div>
              <div>
                <div className="feature-title">
                  {currentLang === 'ta' ? 'பாதுகாப்பானது' : 'Secure & Reliable'}
                </div>
                <div className="feature-sub">
                  {currentLang === 'ta' ? 'தரவு பாதுகாப்பானது' : 'Your data is always safe.'}
                </div>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon"><Zap className="w-4 h-4" /></div>
              <div>
                <div className="feature-title">
                  {currentLang === 'ta' ? 'வேகமானது' : 'Built for Speed'}
                </div>
                <div className="feature-sub">
                  {currentLang === 'ta' ? 'வேகமாக, எளிமையாக' : 'Fast, easy and efficient.'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Already have account ──────────────────────────── */}
        <div className="bottom-signin">
          {t.alreadyHaveAccount}{' '}
          <Link href="/login">
            {t.loginBtn} <ArrowRight className="w-3 h-3 inline" />
          </Link>
        </div>

      </div>

      {/* Google OAuth role selection modal (for new Google users) */}
      <RoleSelectModal
        isOpen={needsRoleSelection}
        lang={currentLang}
        userName={newUserName}
        isLoading={googleLoading}
        onSelect={handleRoleSelect}
      />
    </main>
  );
}
