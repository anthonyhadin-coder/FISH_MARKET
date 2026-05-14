"use client";
import { useState, useEffect, useTransition, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Globe, Eye, EyeOff, Lock, WifiOff, Clock,
  ArrowRight, Phone, Check, ChevronDown, ShieldCheck, Anchor,
} from 'lucide-react';
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
import './login-light.css';

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
    <main className="login-light-layout">

      {/* ── Global success overlay ─────────────────────────────── */}
      <AnimatePresence>
        {loginState === 'success' && (
          <motion.div
            className="ll-success-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div
              style={{
                width: 72, height: 72,
                borderRadius: '50%',
                background: '#e0f0ff',
                border: '2px solid #9ccaff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--clr-primary)',
              }}
            >
              <Check size={34} />
            </div>
            <p style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--clr-on-surface)' }}>
              {currentLang === 'ta' ? 'வெற்றிகரமாக உள்நுழைந்தீர்கள்!' : 'Signed In!'}
            </p>
            <p style={{ fontSize: 14, color: 'var(--clr-on-surface-variant)' }}>{t.redirecting}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════
          LEFT — Branding Pane
          ══════════════════════════════════════════════════════════ */}
      <div className="ll-brand-pane">
        <div className="ll-brand-pane-bg" />
        <div className="ll-brand-pane-overlay" />
        <div className="ll-brand-pane-gradient">
          {/* Brand identity */}
          <div className="ll-brand-identity">
            <div className="ll-brand-icon-wrap">
              <Anchor size={32} strokeWidth={1.8} />
            </div>
            <span className="ll-brand-name">{b.name}&nbsp;<span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 400 }}>{b.sub}</span></span>
          </div>
          {/* Tagline — desktop only */}
          <p className="ll-brand-tagline">{b.tagline}</p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          RIGHT — Form Pane
          ══════════════════════════════════════════════════════════ */}
      <div className="ll-form-pane">
        <div className="ll-form-inner">

          {/* Header row: just lang toggle */}
          <div className="ll-header-row">
            <span />
            <button type="button" onClick={handleLangToggle} className="ll-lang-btn">
              <Globe size={14} />
              {t.langToggle}
              <ChevronDown size={12} />
            </button>
          </div>

          {/* Page title */}
          <h1 className="ll-page-title">{b.signIn}</h1>
          <p className="ll-page-subtitle">{b.subtitle}</p>

          {/* Offline banner */}
          {mounted && isOffline && (
            <motion.div className="ll-offline-banner" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <WifiOff size={16} />
              <span>{t.offlineBanner}</span>
            </motion.div>
          )}

          {/* Error banner */}
          {(error || visibleGoogleError) && (
            <div className="ll-error-banner">
              <span style={{ flex: 1 }}>{error || visibleGoogleError}</span>
              <button type="button" onClick={() => { setError(''); clearGoogleError(); }}>✕</button>
            </div>
          )}

          {/* Method tabs */}
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
          <form ref={formRef} onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {loginMethod === 'password' ? (
              <>
                {/* Phone */}
                <div>
                  <label htmlFor="phone" className="ll-label">{t.phoneLabel}</label>
                  <div style={{ position: 'relative' }}>
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
                  {errors.phone && <p style={{ fontSize: 12, color: 'var(--clr-error)', marginTop: 4, fontWeight: 600 }}>{errors.phone}</p>}
                </div>

                {/* Password */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <label htmlFor="password" className="ll-label" style={{ marginBottom: 0 }}>{t.passwordLabel}</label>
                    <button type="button" className="ll-forgot-link" onClick={() => router.push('/forgot-password')}>
                      {t.forgotPassword}
                    </button>
                  </div>
                  <div style={{ position: 'relative' }}>
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
                      className={`ll-input ${errors.password ? 'error' : ''}`}
                      style={{ paddingRight: '3rem' }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--clr-outline)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}
                    >
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.password && <p style={{ fontSize: 12, color: 'var(--clr-error)', marginTop: 4, fontWeight: 600 }}>{errors.password}</p>}
                </div>

                {/* Keep me signed in */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={keepSignedIn}
                    onChange={e => setKeepSignedIn(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: 'var(--clr-primary)', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 14, color: 'var(--clr-on-surface-variant)' }}>{b.keepSignedIn}</span>
                </label>
              </>
            ) : (
              /* OTP FLOW */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {otpStep === 'phone' ? (
                  <div>
                    <label htmlFor="otp-phone" className="ll-label">{t.phoneLabel}</label>
                    <div style={{ position: 'relative' }}>
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label className="ll-label" style={{ marginBottom: 0 }}>{t.enterOtp}</label>
                      <button type="button" className="ll-forgot-link" onClick={() => setOtpStep('phone')}>
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
                    <p style={{ fontSize: 12, color: 'var(--clr-on-surface-variant)', textAlign: 'center', fontWeight: 500 }}>{t.otpSent}</p>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <button
                        type="button"
                        disabled={resendTimer > 0}
                        onClick={handleSendOtp}
                        style={{ fontSize: 12, fontWeight: 700, color: 'var(--clr-primary)', background: 'none', border: 'none', cursor: resendTimer > 0 ? 'not-allowed' : 'pointer', opacity: resendTimer > 0 ? 0.4 : 1, letterSpacing: '0.05em', textTransform: 'uppercase' }}
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
                  <span style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, fontSize: 13 }}>
                    {loginMethod === 'otp' && otpStep === 'phone' ? t.sendOtp : t.loginLoading}
                  </span>
                </>
              ) : loginState === 'locked' ? (
                <>
                  <Clock size={16} />
                  <span style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, fontSize: 13 }}>
                    {currentLang === 'ta' ? `${retryAfter}s காத்திருக்கவும்` : `Wait ${retryAfter}s`}
                  </span>
                </>
              ) : (
                <>
                  <span style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, fontSize: 13 }}>
                    {loginMethod === 'otp'
                      ? (otpStep === 'phone' ? t.sendOtp : t.loginBtn)
                      : t.loginBtn}
                  </span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* OR divider */}
          <div className="ll-divider">
            <span>{b.orAccess}</span>
          </div>

          {/* Google OAuth */}
          <div
            style={{ width: '100%' }}
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
          <div className="ll-security-badge">
            <ShieldCheck size={13} />
            <span>{t.securedBy}</span>
          </div>

          {/* Sign up link */}
          <div className="ll-bottom-link">
            {b.noAccount}{' '}
            <Link href="/register">{b.createAccount} <ArrowRight size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /></Link>
          </div>

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
      <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9f9ff' }}>
        <div className="ll-wave-bars">
          {[1,2,3,4,5].map(i => <span key={i} style={{ background: '#004370' }} />)}
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
