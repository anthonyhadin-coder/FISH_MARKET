"use client";
import { useState, useEffect, useTransition, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Globe, Eye, EyeOff, Lock, WifiOff, Clock,
  ArrowRight, Phone, Check, ChevronDown, ShieldCheck
} from 'lucide-react';
import { Ship } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { loginT } from '@/lib/loginTranslations';
import api from '@/lib/api';
import GoogleAuthButton from './_components/GoogleAuthButton';
import RoleSelectModal from '@/components/shared/RoleSelectModal';
import { useFormErrors } from '@/hooks/useFormErrors';
import { ApiError } from '@fishmarket/shared-types';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import './login-light.css';

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

// ── UX states ───────────────────────────────────────────────────
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
  // Google click guard (same as register page)
  const [googleClicked, setGoogleClicked] = useState(false);

  const { errors, clearAllErrors, formRef, getInputProps } = useFormErrors();
  const { lang, setLang } = useLanguage();
  const { user, login, isLoading } = useAuth();
  const router            = useRouter();
  const searchParams      = useSearchParams();
  const [, startTransition] = useTransition();

  const currentLang = (lang === 'ta' || lang === 'en') ? lang : 'en';
  const t = loginT[currentLang];

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

  // ── Mount / offline ────────────────────────────────────────────
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

  // ── Redirect if already logged in ─────────────────────────────
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

  // ── OAuth redirect error / credential params ───────────────────
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

  // ── Lockout countdown ─────────────────────────────────────────
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

  // ── Resend OTP countdown ──────────────────────────────────────
  useEffect(() => {
    if (resendTimer <= 0) return;
    const id = setInterval(() => setResendTimer(s => s - 1), 1000);
    return () => clearInterval(id);
  }, [resendTimer]);

  // ── OTP handlers ─────────────────────────────────────────────
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
      if (!auth) throw new Error("Firebase Auth not initialized");
      setupRecaptcha();
      // Ensure phone is E.164 format
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

  // ── Password / OTP form submit ────────────────────────────────
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
    <main className="login-light-layout">
      <div className="login-light-content">

        {/* ── Header ──────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="ll-brand-icon">
              <Ship className="w-8 h-8" />
            </div>
            <div>
              <div className="ll-brand-name">
                {currentLang === 'ta' ? 'ஆழ் கடல்' : 'DEEP OCEAN'}
              </div>
              <div className="ll-brand-sub">
                {currentLang === 'ta' ? 'மீன் சந்தை' : 'FISH MARKET'}
              </div>
              <div className="ll-brand-tag">
                {currentLang === 'ta' ? 'எளிமையானது. மீனவர்களுக்காக.' : 'Smart. Simple. Built for Fishermen.'}
              </div>
            </div>
          </div>

          <button type="button" onClick={handleLangToggle} className="ll-lang-btn">
            <Globe className="w-4 h-4 text-blue-600" />
            {t.langToggle}
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
        </div>

        {/* ── Sign in title ─────────────────────────────── */}
        <h1 className="text-[22px] font-black text-slate-900 mb-1">
          {currentLang === 'ta' ? 'உள்நுழைக' : 'Sign In'}
        </h1>
        <p className="text-sm text-slate-500 font-medium mb-4">
          {currentLang === 'ta' ? 'உங்கள் கணக்கை அணுகவும்' : 'Access your fish market account'}
        </p>

        {/* ── Card ──────────────────────────────────────── */}
        <div className="ll-card">

          {/* Success overlay */}
          <AnimatePresence>
            {loginState === 'success' && (
              <motion.div
                className="ll-success-overlay"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <div className="w-16 h-16 bg-blue-50 border border-blue-200 text-blue-600 rounded-full flex items-center justify-center">
                  <Check className="w-8 h-8" />
                </div>
                <p className="text-lg font-bold text-slate-800">
                  {currentLang === 'ta' ? 'வெற்றிகரமாக உள்நுழைந்தீர்கள்!' : 'Signed In!'}
                </p>
                <p className="text-sm text-slate-500">{t.redirecting}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Offline banner – only after mount */}
          {mounted && isOffline && (
            <motion.div
              className="ll-offline-banner"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            >
              <WifiOff className="w-4 h-4 flex-shrink-0" />
              <span>{t.offlineBanner}</span>
            </motion.div>
          )}

          {/* Error banner */}
          {(error || visibleGoogleError) && (
            <div className="ll-error-banner">
              <span className="flex-1">{error || visibleGoogleError}</span>
              <button type="button" onClick={() => { setError(''); clearGoogleError(); }}>✕</button>
            </div>
          )}

          {/* Method tabs: Password / OTP */}
          <div className="ll-tabs">
            <button
              type="button"
              onClick={() => { setLoginMethod('password'); setLoginState('idle'); setError(''); }}
              className={`ll-tab ${loginMethod === 'password' ? 'active' : ''}`}
            >
              {currentLang === 'ta' ? 'கடவுச்சொல்' : 'Password'}
            </button>
            <button
              type="button"
              onClick={() => { setLoginMethod('otp'); setLoginState('idle'); setError(''); }}
              className={`ll-tab ${loginMethod === 'otp' ? 'active' : ''}`}
            >
              OTP
            </button>
          </div>

          {/* Form */}
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4" noValidate>

            {loginMethod === 'password' ? (
              <>
                {/* Phone */}
                <div>
                  <label htmlFor="phone" className="ll-label">
                    {t.phoneLabel}
                  </label>
                  <div className="relative">
                    <Phone className="ll-input-icon" />
                    <input
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
                      className={`ll-input ${errors.phone ? 'error' : ''}`}
                      required
                    />
                  </div>
                  {errors.phone && (
                    <p className="text-xs text-red-500 mt-1 font-medium">{errors.phone}</p>
                  )}
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="password" className="ll-label" style={{marginBottom:0}}>
                      {t.passwordLabel}
                    </label>
                    <button
                      type="button"
                      className="ll-forgot-link"
                      onClick={() => router.push('/forgot-password')}
                    >
                      {t.forgotPassword}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="ll-input-icon" />
                    <input
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
                      className={`ll-input pr-12 ${errors.password ? 'error' : ''}`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-red-500 mt-1 font-medium">{errors.password}</p>
                  )}
                </div>
              </>
            ) : (
              /* OTP FLOW */
              <div className="space-y-4">
                {otpStep === 'phone' ? (
                  <div>
                    <label htmlFor="otp-phone" className="ll-label">{t.phoneLabel}</label>
                    <div className="relative">
                      <Phone className="ll-input-icon" />
                      <input
                        id="otp-phone"
                        type="tel"
                        autoComplete="tel"
                        placeholder={t.phonePlaceholder}
                        value={phone}
                        onChange={e => setPhone(e.target.value.replace(/[^\d+\-\s()]/g, ''))}
                        className="ll-input"
                        required
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="ll-label" style={{marginBottom:0}}>{t.enterOtp}</label>
                      <button
                        type="button"
                        className="ll-forgot-link"
                        onClick={() => setOtpStep('phone')}
                      >
                        {currentLang === 'ta' ? 'மாற்று' : 'Change Phone'}
                      </button>
                    </div>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="000000"
                      value={otp}
                      onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                      className="ll-otp-input"
                      autoFocus
                    />
                    <p className="text-xs text-slate-500 text-center font-medium">{t.otpSent}</p>
                    <div className="flex justify-center">
                      <button
                        type="button"
                        disabled={resendTimer > 0}
                        onClick={handleSendOtp}
                        className="text-xs font-bold text-blue-600 disabled:opacity-40 uppercase tracking-wide"
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
              className={`ll-submit-btn ${loginState === 'locked' ? 'locked' : ''}`}
            >
              {loginState === 'loading' ? (
                <>
                  <div className="ll-wave-bars">
                    {[1,2,3,4,5].map(i => <span key={i} />)}
                  </div>
                  <span className="uppercase tracking-widest font-black text-sm">
                    {loginMethod === 'otp' && otpStep === 'phone' ? t.sendOtp : t.loginLoading}
                  </span>
                </>
              ) : loginState === 'locked' ? (
                <>
                  <Clock className="w-4 h-4" />
                  <span className="uppercase tracking-widest font-black text-sm">
                    {currentLang === 'ta' ? `${retryAfter}s காத்திருக்கவும்` : `Wait ${retryAfter}s`}
                  </span>
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4" />
                  <span className="uppercase tracking-widest font-black text-sm">
                    {loginMethod === 'otp'
                      ? (otpStep === 'phone' ? t.sendOtp : t.loginBtn)
                      : t.loginBtn}
                  </span>
                </>
              )}
            </button>
          </form>

          {/* OR divider */}
          <div className="ll-divider">
            <span>{t.dividerOr}</span>
          </div>

          {/* Google OAuth */}
          <div
            className="w-full flex justify-center mb-0"
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
                if (googleClicked) handleGoogleError();
              }}
            />
          </div>

          {/* Security badge */}
          <div className="flex items-center justify-center gap-2 mt-5 text-[11px] text-slate-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            {t.securedBy}
          </div>
        </div>

        {/* Sign up link */}
        <div className="ll-bottom-link">
          {t.dontHaveAccount}{' '}
          <Link href="/register">
            {t.createAccount} <ArrowRight className="w-3 h-3 inline" />
          </Link>
        </div>

      </div>

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

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="login-light-layout min-h-screen flex items-center justify-center">
        <div className="ll-wave-bars">
          {[1,2,3,4,5].map(i => <span key={i} style={{background:'#1D6AE5'}} />)}
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
