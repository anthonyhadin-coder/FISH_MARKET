"use client";
import { useState, useEffect, useTransition, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Globe, Eye, EyeOff, Lock, WifiOff, Clock,
  ArrowRight, Phone, Check, ChevronDown
} from 'lucide-react';
import AuthLayout from '@/components/auth/AuthLayout';
import AuthCard from '@/components/auth/AuthCard';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { T as loginT } from '@/lib/i18n';
import api from '@/lib/api';
import GoogleAuthButton from './_components/GoogleAuthButton';
import RoleSelectModal from '@/components/shared/RoleSelectModal';
import { ControlledInput } from '@/components/auth/ControlledInput';
import { useFormErrors } from '@/hooks/useFormErrors';
import { ApiError } from '@fishmarket/shared-types';

// ── UX states ───────────────────────────────────────────────────────
type LoginState =
  | 'idle' | 'typing' | 'loading'
  | 'success' | 'error' | 'locked'
  | 'offline' | 'sessionExpired';

function getFriendlyError(err: ApiError, lang: string = 'en'): string {
  const isTa = lang === 'ta';
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return isTa ? 'நீங்கள் ஆஃப்லைனில் இருக்கிறீர்கள்.' : 'You appear to be offline.';
  }
  const status = err.response?.status;
  const msg = err.response?.data?.message || '';
  if (status === 401) {
    return isTa ? 'தவறான தொலைபேசி எண் அல்லது கடவுச்சொல்.' : 'Incorrect phone number or password.';
  }
  if (status === 403) {
    return isTa ? 'உங்கள் கணக்கு முடக்கப்பட்டுள்ளது. ஆதரவைத் தொடர்பு கொள்ளவும்.' : 'Your account has been locked. Contact support.';
  }
  if (status === 429) {
    return isTa ? 'பல முயற்சிகள். தயவுசெய்து சிறிது நேரம் காத்திருந்து மீண்டும் முயற்சிக்கவும்.' : 'Too many attempts. Please wait and try again.';
  }
  if (status && status >= 500) {
    return isTa ? 'சேவையக பிழை. தயவுசெய்து சிறிது நேரத்தில் மீண்டும் முயற்சிக்கவும்.' : 'Server error. Please try again in a moment.';
  }
  if (err.message === 'Network Error') {
    return isTa ? 'சேவையகத்தை இணைக்க முடியவில்லை. உங்கள் இணைப்பைச் சரிபார்க்கவும்.' : 'Cannot reach the server. Check your connection.';
  }
  const safeMsgs = ['User not found', 'Invalid password', 'Account locked', 'Invalid phone number or password.'];
  if (safeMsgs.includes(msg)) {
    if (isTa) {
      if (msg === 'User not found' || msg === 'Invalid password' || msg === 'Invalid phone number or password.') {
        return 'தவறான தொலைபேசி எண் அல்லது கடவுச்சொல்.';
      }
      if (msg === 'Account locked') {
        return 'உங்கள் கணக்கு முடக்கப்பட்டுள்ளது. ஆதரவைத் தொடர்பு கொள்ளவும்.';
      }
    }
    return msg;
  }
  return isTa ? 'உள்நுழைவு தோல்வியடைந்தது. மீண்டும் முயற்சிக்கவும்.' : 'Login failed. Please try again.';
}

// ── Branding strings ─────────────────────────────────────────────────
const BRAND = {
  en: {
    name: 'DEEP OCEAN',
    sub: 'Fish Market',
    tagline: 'Secure access to maritime catch records, fleet logistics, and high-frequency trading terminals.',
    signIn: 'Sign In',
    subtitle: 'Enter your credentials to access the terminal.',
    noAccount: "Don't have an account?",
    createAccount: 'Create Account',
    keepSignedIn: 'Keep me signed in',
    continueGoogle: 'Continue with Google',
    orAccess: 'Or access via',
  },
  ta: {
    name: 'ஆழ் கடல்',
    sub: 'மீன் சந்தை',
    tagline: 'கப்பல் பதிவேடுகள், படகு தளவாட மேலாண்மை மற்றும் வர்த்தக முனையங்களுக்கான பாதுகாப்பான அணுகல்.',
    signIn: 'உள்நுழைக',
    subtitle: 'முனையத்தை அணுக உங்கள் நற்சான்றுகளை உள்ளிடவும்.',
    noAccount: 'கணக்கு இல்லையா?',
    createAccount: 'கணக்கை உருவாக்கு',
    keepSignedIn: 'உள்நுழைந்திருக்கவும்',
    continueGoogle: 'Google மூலம் தொடரவும்',
    orAccess: 'அல்லது இதன் மூலம் அணுகவும்',
  },
};

function LoginContent() {
  const [loginState, setLoginState]   = useState<LoginState>('idle');
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password');
  const [otpStep, setOtpStep]         = useState<'phone' | 'verify'>('phone');
  const [otp, setOtp]                 = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [error, setError]             = useState('');
  const [phone, setPhone]             = useState('');
  const [password, setPassword]       = useState('');
  const [showPass, setShowPass]       = useState(false);
  const [retryAfter, setRetryAfter]   = useState(0);
  const [mounted, setMounted]         = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [googleClicked, setGoogleClicked] = useState(false);

  const { errors, clearAllErrors, formRef, getInputProps } = useFormErrors();
  const { lang, setLang } = useLanguage();
  const { user, login, isLoading } = useAuth();
  const router            = useRouter();
  const searchParams      = useSearchParams();
  const [, startTransition] = useTransition();

  const currentLang = (lang === 'ta' || lang === 'en') ? lang : 'en';
  const t  = loginT[currentLang];
  const b  = BRAND[currentLang];

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

  // ── Mount / offline ─────────────────────────────────────────────
  useEffect(() => {
    // BUG FIX #6: Removed setTimeout wrapper — useEffect is already client-only.
    // The previous pattern delayed mounting unnecessarily and could set state
    // on an unmounted component if the user navigated away within the same tick.
    setMounted(true);
    if (!navigator.onLine) setLoginState('offline');
    const onOnline  = () => setLoginState(s => s === 'offline' ? 'idle' : s);
    const onOffline = () => setLoginState('offline');
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // ── Redirect if already logged in ───────────────────────────────
  useEffect(() => {
    if (user && !isLoading) {
      const r = user.role.toLowerCase();
      if (r === 'owner' || r === 'admin') router.push('/owner');
      else if (r === 'agent') router.push('/agent');
      else if (r === 'buyer') router.push('/marketplace');
      else router.push(`/${r}`);
    }
  }, [user, isLoading, router]);

  // ── OAuth redirect error / credential params ─────────────────────
  useEffect(() => {
    const errorParam = searchParams?.get('error');
    if (errorParam === 'google_failed' && loginState !== 'error') {
      setTimeout(() => {
        setLoginState('error');
        setError('Google sign-in failed. Please try again or use phone/password.');
      }, 0);
    }
    const credParam = searchParams?.get('credential');
    if (credParam && loginState === 'idle') {
      setTimeout(() => {
        setGoogleClicked(true);
        handleGoogleSuccess(credParam);
      }, 0);
    }
    if (errorParam || credParam) router.replace('/login', { scroll: false });
  }, [searchParams, router, loginState, handleGoogleSuccess]);

  // ── Lockout countdown ────────────────────────────────────────────
  useEffect(() => {
    if (retryAfter <= 0) return;
    const id = setInterval(() => {
      setRetryAfter(r => {
        if (r <= 1) { clearInterval(id); setLoginState('idle'); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [retryAfter]);

  // ── Resend OTP countdown ─────────────────────────────────────────
  useEffect(() => {
    if (resendTimer <= 0) return;
    const id = setInterval(() => setResendTimer(s => s - 1), 1000);
    return () => clearInterval(id);
  }, [resendTimer]);

  const handleSendOtp = async () => {
    if (!phone) return;
    setLoginState('loading');
    setError('');
    try {
      await api.post('/auth/phone/send-otp', { phone });
      setOtpStep('verify');
      setResendTimer(60);
      setLoginState('idle');
    } catch (err: unknown) {
      console.error(err);
      setLoginState('error');
      const apiErr = err as ApiError;
      setError(apiErr.response?.data?.message || 'Failed to send OTP via SMS. Check your number.');
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) return;
    setLoginState('loading');
    setError('');
    try {
      const res = await api.post('/auth/phone/verify-otp', { phone, otp });
      setLoginState('success');
      login(res.data.user);
    } catch (err: unknown) {
      console.error(err);
      setLoginState('error');
      const apiErr = err as ApiError;
      setError(apiErr.response?.data?.message || t.invalidOtp);
    }
  };

  // ── Password / OTP form submit ───────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginState === 'loading' || loginState === 'locked') return;
    if (loginMethod === 'otp') {
      if (otpStep === 'phone') handleSendOtp();
      else handleVerifyOtp();
      return;
    }
    setLoginState('loading');
    setError('');
    clearAllErrors();
    try {
      // BUG FIX #23: keepSignedIn was collected from UI but never sent to backend.
      const res = await api.post('/auth/login', { phone, password, keepSignedIn });
      setLoginState('success');
      login(res.data.user);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      if (apiErr.response?.status === 429) {
        setLoginState('locked');
        // BUG FIX #5: Backend sends retryAfter in response body — use it instead of hardcoding 60s.
        // Cast to any: ApiError's data type is narrowly typed and doesn't include retryAfter,
        // but the server contract guarantees it on 429 responses.
        setRetryAfter((apiErr.response?.data as any)?.retryAfter || 60);
      } else {
        setLoginState('error');
      }
      setError(getFriendlyError(apiErr, currentLang));
    }
  };

  const handleLangToggle = () => {
    startTransition(() => setLang(lang === 'en' ? 'ta' : 'en'));
  };

  const isOffline = loginState === 'offline';

  return (
    <AuthLayout lang={currentLang}>
      <AuthCard>
        {/* Global success overlay */}
        <AnimatePresence>
          {loginState === 'success' && (
            <motion.div
              className="absolute inset-0 z-50 bg-white/95 flex flex-col items-center justify-center rounded-2xl backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="w-20 h-20 rounded-full bg-ocean-50 border-4 border-ocean-100 flex items-center justify-center text-ocean-600 mb-6 shadow-sm">
                <Check size={40} strokeWidth={2.5} />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
                {currentLang === 'ta' ? 'வெற்றிகரமாக உள்நுழைந்தீர்கள்!' : 'Signed In Successfully'}
              </h2>
              <p className="text-slate-500 mt-2 font-medium">{t.redirecting}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{b.signIn}</h2>
            <p className="text-ocean-200/70 text-sm mt-1.5 font-medium">{b.subtitle}</p>
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
        {/* BUG FIX #21: Original used light-theme colours (bg-orange-50, text-orange-700) which
            have insufficient contrast against the dark AuthCard background — WCAG AA fail.
            Replaced with dark-safe equivalents. */}
        {mounted && isOffline && (
          <motion.div className="mb-6 p-3 bg-orange-900/20 border border-orange-600/40 rounded-xl flex items-center gap-3 text-orange-200 text-sm font-medium" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
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

        {/* Method tabs */}
        <div className="flex p-1 bg-black/20 rounded-lg mb-6 shadow-inner border border-white/5">
          <button
            type="button"
            onClick={() => { setLoginMethod('password'); setLoginState('idle'); setError(''); }}
            className={`flex-1 py-2.5 text-sm font-bold rounded-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 ${loginMethod === 'password' ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/10' : 'text-slate-400 hover:text-slate-200'}`}
          >
            {currentLang === 'ta' ? 'கடவுச்சொல்' : 'Password'}
          </button>
          <button
            type="button"
            onClick={() => { setLoginMethod('otp'); setLoginState('idle'); setError(''); }}
            className={`flex-1 py-2.5 text-sm font-bold rounded-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 ${loginMethod === 'otp' ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/10' : 'text-slate-400 hover:text-slate-200'}`}
          >
            OTP
          </button>
        </div>

        {/* Stable Recaptcha Container */}
        <div id="recaptcha-container" className="hidden"></div>

        {/* Form */}
        <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-5">
          <div className="relative h-[240px] overflow-visible">
            {/* PASSWORD FLOW */}
            <div className={`absolute inset-0 transition-all duration-300 ${loginMethod === 'password' ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'}`}>
              <div className="space-y-5">
                {/* Phone */}
                <ControlledInput
                  name="phone"
                  type="tel"
                  label={t.phoneLabel}
                  icon={Phone}
                  autoComplete="tel"
                  placeholder={t.phonePlaceholder}
                  value={phone}
                  onChange={e => {
                    setPhone(e.target.value.replace(/[^\d+\-\s()]/g, ''));
                    getInputProps('phone').onChange();
                    if (loginState !== 'typing') setLoginState('typing');
                  }}
                  error={errors.phone}
                  required={loginMethod === 'password'}
                />

                {/* Password */}
                <ControlledInput
                  name="password"
                  type={showPass ? 'text' : 'password'}
                  label={t.passwordLabel}
                  labelRight={
                    <button type="button" className="text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-all" onClick={() => router.push('/forgot-password')}>
                      {t.forgotPassword}
                    </button>
                  }
                  icon={Lock}
                  autoComplete="current-password"
                  placeholder={t.passwordPlaceholder}
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    getInputProps('password').onChange();
                    if (loginState !== 'typing') setLoginState('typing');
                  }}
                  error={errors.password}
                  required={loginMethod === 'password'}
                  rightElement={
                    // BUG FIX #22: focus:outline-none with no custom indicator fails WCAG 2.4.7. Added focus ring.
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      aria-label={showPass ? 'Hide password' : 'Show password'}
                      className="p-1 text-slate-400 hover:text-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                    >
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                />

                {/* Keep me signed in */}
                <label className="flex items-center gap-3 cursor-pointer group w-fit mt-2">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={keepSignedIn}
                      onChange={e => setKeepSignedIn(e.target.checked)}
                      className="w-4 h-4 border-2 border-white/20 bg-white/5 rounded text-cyan-500 focus:ring-cyan-500/50 cursor-pointer transition-all"
                    />
                  </div>
                  <span className="text-sm font-semibold text-slate-400 group-hover:text-slate-200 transition-colors">{b.keepSignedIn}</span>
                </label>
              </div>
            </div>

            {/* OTP FLOW */}
            <div className={`absolute inset-0 transition-all duration-300 ${loginMethod === 'otp' ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'}`}>
              <div className="space-y-5">
                {otpStep === 'phone' ? (
                  <ControlledInput
                    name="otp-phone"
                    type="tel"
                    label={t.phoneLabel}
                    icon={Phone}
                    autoComplete="tel"
                    placeholder={t.phonePlaceholder}
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/[^\d+\-\s()]/g, ''))}
                    required={loginMethod === 'otp' && otpStep === 'phone'}
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-bold text-slate-200 tracking-tight">{t.enterOtp}</label>
                      <button type="button" className="text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500/40 rounded px-2 py-1" onClick={() => setOtpStep('phone')}>
                        {currentLang === 'ta' ? 'மாற்று' : 'Change Phone'}
                      </button>
                    </div>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="000000"
                      value={otp}
                      onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                      className="block w-full h-12 text-center tracking-[0.5em] sm:tracking-[0.75em] text-xl sm:text-2xl font-black bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 transition-all shadow-sm"
                      autoFocus
                      aria-label="One-time password"
                    />
                    <p className="text-xs font-semibold text-slate-400 text-center">{t.otpSent}</p>
                    <div className="flex justify-center">
                      <button
                        type="button"
                        disabled={resendTimer > 0}
                        onClick={handleSendOtp}
                        className={`text-xs font-bold uppercase tracking-wider transition-all px-3 py-1.5 rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500/40 ${resendTimer > 0 ? 'text-slate-500 cursor-not-allowed' : 'text-cyan-400 hover:text-cyan-300'}`}
                      >
                        {resendTimer > 0 ? t.resendIn.replace('[s]', String(resendTimer)) : t.resendOtp}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loginState === 'loading' || loginState === 'locked'}
            className={`w-full h-12 mt-2 flex items-center justify-center gap-2 rounded-lg text-sm font-bold text-white transition-all transform active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ocean-600 shadow-md ${
              loginState === 'locked' 
                ? 'bg-slate-400 shadow-none cursor-not-allowed' 
                : loginState === 'loading'
                  ? 'bg-ocean-500 shadow-none cursor-wait'
                  : 'bg-ocean-600 hover:bg-ocean-700 hover:shadow-lg'
            }`}
          >
            {loginState === 'loading' ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>{loginMethod === 'otp' && otpStep === 'phone' ? t.sendOtp : t.loginLoading}</span>
              </>
            ) : loginState === 'locked' ? (
              <>
                <Clock className="h-4 w-4" />
                <span>{currentLang === 'ta' ? `${retryAfter}s காத்திருக்கவும்` : `Wait ${retryAfter}s`}</span>
              </>
            ) : (
              <>
                <span>{loginMethod === 'otp' ? (otpStep === 'phone' ? t.sendOtp : t.loginBtn) : t.loginBtn}</span>
                <ArrowRight className="h-4 w-4 opacity-90" />
              </>
            )}
          </button>
        </form>

        {/* OR divider */}
        <div className="flex items-center justify-center my-6">
          <div className="h-px bg-white/10 flex-1"></div>
          <span className="px-4 text-xs font-bold text-slate-500 tracking-wider uppercase">{b.orAccess}</span>
          <div className="h-px bg-white/10 flex-1"></div>
        </div>

        {/* Google OAuth Wrapper */}
        <div onClick={() => setGoogleClicked(true)} className="w-full">
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
              if (googleClicked) handleGoogleError();
            }}
          />
        </div>

        {/* Sign up link */}
        <div className="mt-8 text-center text-sm font-medium text-slate-400">
          {b.noAccount}{' '}
          <Link href="/register" className="text-cyan-400 hover:text-cyan-300 font-bold transition-colors inline-flex items-center gap-1 group">
            {b.createAccount}
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

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[100svh] flex items-center justify-center bg-[radial-gradient(circle_at_top,#0f172a,#020617)]">
        <svg className="animate-spin h-10 w-10 text-cyan-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
