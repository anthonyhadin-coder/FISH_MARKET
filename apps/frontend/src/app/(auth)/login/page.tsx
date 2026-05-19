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
import { useFormErrors } from '@/hooks/useFormErrors';
import { ApiError } from '@fishmarket/shared-types';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { auth } from '@/lib/firebase';

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

// ── UX states ───────────────────────────────────────────────────────
type LoginState =
  | 'idle' | 'typing' | 'loading'
  | 'success' | 'error' | 'locked'
  | 'offline' | 'sessionExpired';

function getFriendlyError(err: ApiError): string {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'You appear to be offline.';
  const status = err.response?.status;
  const msg = err.response?.data?.message || '';
  if (status === 401) return 'Incorrect phone number or password.';
  if (status === 403) return 'Your account has been locked. Contact support.';
  if (status === 429) return 'Too many attempts. Please wait and try again.';
  if (status && status >= 500) return 'Server error. Please try again in a moment.';
  if (err.message === 'Network Error') return 'Cannot reach the server. Check your connection.';
  const safeMsgs = ['User not found', 'Invalid password', 'Account locked', 'Invalid phone number or password.'];
  if (safeMsgs.includes(msg)) return msg;
  return 'Login failed. Please try again.';
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
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
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
    setTimeout(() => {
      setMounted(true);
      if (!navigator.onLine) setLoginState('offline');
    }, 0);
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
      else if (r === 'buyer') router.push('/customer');
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

  // ── OTP handlers ─────────────────────────────────────────────────
  const setupRecaptcha = () => {
    if (!auth) return;
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth!, 'login-submit-btn', {
        size: 'invisible'
      });
    }
  };

  const handleSendOtp = async () => {
    if (!phone) return;
    setLoginState('loading');
    setError('');
    try {
      if (!auth) throw new Error('Firebase Auth not initialized');
      setupRecaptcha();
      const formattedPhone = phone.startsWith('+') ? phone : (phone.length === 10 ? `+91${phone}` : `+${phone}`);
      const confirmation = await signInWithPhoneNumber(auth!, formattedPhone, window.recaptchaVerifier!);
      setConfirmationResult(confirmation);
      setOtpStep('verify');
      setResendTimer(60);
      setLoginState('idle');
    } catch (err) {
      console.error(err);
      setLoginState('error');
      setError('Failed to send OTP via SMS. Check your number.');
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        delete window.recaptchaVerifier;
      }
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6 || !confirmationResult) return;
    setLoginState('loading');
    setError('');
    try {
      const result = await confirmationResult.confirm(otp);
      const idToken = await result.user.getIdToken();
      const res = await api.post('/auth/phone/firebase-login', { idToken });
      setLoginState('success');
      await new Promise(r => setTimeout(r, 1000));
      login(res.data.user);
    } catch (err) {
      console.error(err);
      setLoginState('error');
      setError(t.invalidOtp);
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
      const res = await api.post('/auth/login', { phone, password });
      setLoginState('success');
      await new Promise(r => setTimeout(r, 1000));
      login(res.data.user);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      if (apiErr.response?.status === 429) {
        setLoginState('locked');
        setRetryAfter(60);
      } else {
        setLoginState('error');
      }
      setError(getFriendlyError(apiErr));
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
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{b.signIn}</h2>
            <p className="text-slate-500 text-sm mt-1.5 font-medium">{b.subtitle}</p>
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
        {mounted && isOffline && (
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

        {/* Method tabs */}
        <div className="flex p-1 bg-slate-100 rounded-xl mb-6 shadow-inner">
          <button
            type="button"
            onClick={() => { setLoginMethod('password'); setLoginState('idle'); setError(''); }}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${loginMethod === 'password' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {currentLang === 'ta' ? 'கடவுச்சொல்' : 'Password'}
          </button>
          <button
            type="button"
            onClick={() => { setLoginMethod('otp'); setLoginState('idle'); setError(''); }}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${loginMethod === 'otp' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            OTP
          </button>
        </div>

        {/* Form */}
        <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-5">
          {loginMethod === 'password' ? (
            <>
              {/* Phone */}
              <div className="space-y-1.5">
                <label htmlFor="phone" className="block text-sm font-semibold text-slate-700 tracking-tight">{t.phoneLabel}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder={t.phonePlaceholder}
                    value={phone}
                    {...getInputProps('phone')}
                    onChange={e => {
                      setPhone(e.target.value.replace(/[^\d+\-\s()]/g, ''));
                      getInputProps('phone').onChange();
                      if (loginState !== 'typing') setLoginState('typing');
                    }}
                    className={`block w-full h-12 md:h-14 pl-11 pr-4 bg-slate-50 border ${errors.phone ? 'border-coral-500 focus:ring-coral-500' : 'border-slate-200 focus:border-ocean-500 focus:ring-ocean-500'} rounded-xl text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-opacity-20 transition-all sm:text-sm`}
                    required
                  />
                </div>
                {errors.phone && <p className="text-xs font-semibold text-coral-600 mt-1">{errors.phone}</p>}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-semibold text-slate-700 tracking-tight">{t.passwordLabel}</label>
                  <button type="button" className="text-sm font-semibold text-ocean-600 hover:text-ocean-700 hover:underline transition-all" onClick={() => router.push('/forgot-password')}>
                    {t.forgotPassword}
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="password"
                    type={showPass ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder={t.passwordPlaceholder}
                    value={password}
                    {...getInputProps('password')}
                    onChange={e => {
                      setPassword(e.target.value);
                      getInputProps('password').onChange();
                      if (loginState !== 'typing') setLoginState('typing');
                    }}
                    className={`block w-full h-12 md:h-14 pl-11 pr-12 bg-slate-50 border ${errors.password ? 'border-coral-500 focus:ring-coral-500' : 'border-slate-200 focus:border-ocean-500 focus:ring-ocean-500'} rounded-xl text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-opacity-20 transition-all sm:text-sm`}
                    required
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

              {/* Keep me signed in */}
              <label className="flex items-center gap-2.5 cursor-pointer group w-fit">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={keepSignedIn}
                    onChange={e => setKeepSignedIn(e.target.checked)}
                    className="w-5 h-5 border-2 border-slate-300 rounded text-ocean-600 focus:ring-ocean-500 focus:ring-offset-0 cursor-pointer transition-all peer"
                  />
                </div>
                <span className="text-sm font-medium text-slate-600 group-hover:text-slate-800 transition-colors">{b.keepSignedIn}</span>
              </label>
            </>
          ) : (
            /* OTP FLOW */
            <div className="space-y-5">
              {otpStep === 'phone' ? (
                <div className="space-y-1.5">
                  <label htmlFor="otp-phone" className="block text-sm font-semibold text-slate-700 tracking-tight">{t.phoneLabel}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Phone className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      id="otp-phone"
                      type="tel"
                      autoComplete="tel"
                      placeholder={t.phonePlaceholder}
                      value={phone}
                      onChange={e => setPhone(e.target.value.replace(/[^\d+\-\s()]/g, ''))}
                      className="block w-full h-12 md:h-14 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:border-ocean-500 focus:ring-2 focus:ring-ocean-500 focus:ring-opacity-20 transition-all sm:text-sm"
                      required
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-semibold text-slate-700 tracking-tight">{t.enterOtp}</label>
                    <button type="button" className="text-sm font-semibold text-ocean-600 hover:text-ocean-700 hover:underline transition-all" onClick={() => setOtpStep('phone')}>
                      {currentLang === 'ta' ? 'மாற்று' : 'Change Phone'}
                    </button>
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="block w-full h-14 md:h-16 text-center tracking-[0.5em] text-2xl font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-ocean-500 focus:ring-2 focus:ring-ocean-500 focus:ring-opacity-20 transition-all"
                    autoFocus
                  />
                  <p className="text-xs font-medium text-slate-500 text-center">{t.otpSent}</p>
                  <div className="flex justify-center">
                    <button
                      type="button"
                      disabled={resendTimer > 0}
                      onClick={handleSendOtp}
                      className={`text-xs font-bold uppercase tracking-wider transition-all ${resendTimer > 0 ? 'text-slate-400 cursor-not-allowed' : 'text-ocean-600 hover:text-ocean-700 cursor-pointer'}`}
                    >
                      {resendTimer > 0 ? t.resendIn.replace('[s]', String(resendTimer)) : t.resendOtp}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Submit button */}
          <button
            id="login-submit-btn"
            type="submit"
            disabled={loginState === 'loading' || loginState === 'locked'}
            className={`w-full h-12 md:h-14 mt-2 flex items-center justify-center gap-2 rounded-xl text-sm font-bold uppercase tracking-wider text-white transition-all transform active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ocean-600 shadow-md ${
              loginState === 'locked' 
                ? 'bg-slate-300 shadow-none cursor-not-allowed' 
                : loginState === 'loading'
                  ? 'bg-ocean-500 shadow-none cursor-wait'
                  : 'bg-ocean-600 hover:bg-ocean-700 hover:shadow-lg'
            }`}
          >
            {loginState === 'loading' ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>{loginMethod === 'otp' && otpStep === 'phone' ? t.sendOtp : t.loginLoading}</span>
              </>
            ) : loginState === 'locked' ? (
              <>
                <Clock className="h-5 w-5" />
                <span>{currentLang === 'ta' ? `${retryAfter}s காத்திருக்கவும்` : `Wait ${retryAfter}s`}</span>
              </>
            ) : (
              <>
                <span>{loginMethod === 'otp' ? (otpStep === 'phone' ? t.sendOtp : t.loginBtn) : t.loginBtn}</span>
                <ArrowRight className="h-5 w-5 opacity-90" />
              </>
            )}
          </button>
        </form>

        {/* OR divider */}
        <div className="flex items-center justify-center my-6">
          <div className="h-px bg-slate-200 flex-1"></div>
          <span className="px-4 text-xs font-bold text-slate-400 tracking-wider uppercase">{b.orAccess}</span>
          <div className="h-px bg-slate-200 flex-1"></div>
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
        <div className="mt-8 text-center text-sm font-medium text-slate-600">
          {b.noAccount}{' '}
          <Link href="/register" className="text-ocean-600 hover:text-ocean-800 font-bold transition-colors inline-flex items-center gap-1 group">
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
      <div className="min-h-[100svh] flex items-center justify-center bg-slate-50">
        <svg className="animate-spin h-10 w-10 text-ocean-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
