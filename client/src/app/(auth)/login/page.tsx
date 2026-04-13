"use client";
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Globe, Eye, EyeOff, CheckCircle2, Lock, WifiOff, AlertTriangle, Clock, ArrowRight, Phone } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { loginT } from '@/lib/loginTranslations';
import api from '@/lib/api';
import GoogleAuthButton from './_components/GoogleAuthButton';
import RoleSelectModal from '@/components/shared/RoleSelectModal';
import { useFormErrors } from '@/hooks/useFormErrors';
import { ApiError } from '@/lib/types';
import './login.css';

// ── Demo quick-fill accounts ─────────────────────────────────────
const DEMO_USERS = [
  { username: '9876543210', password: 'password123', label: 'Ravi (Agent)' },
  { username: '1111111111', password: 'owner1234',   label: 'Admin Owner' },
];

// ── UX states ───────────────────────────────────────────────────
type LoginState =
  | 'idle'
  | 'typing'
  | 'loading'
  | 'success'
  | 'error'
  | 'locked'
  | 'offline'
  | 'sessionExpired';

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
  const [cooldown, setCooldown]       = useState(0);   

  const { errors, clearAllErrors, formRef, getInputProps } = useFormErrors();

  const { lang, setLang } = useLanguage();
  const { user, login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Safely resolve translation set
  const currentLang = (lang === 'ta' || lang === 'en') ? lang : 'en';
  const t = loginT[currentLang];

  // Google auth hook
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

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      if (user.role === 'owner' || user.role === 'admin') router.push('/owner');
      else if (user.role === 'agent') router.push('/staff');
      else if (user.role === 'buyer') router.push('/customer');
      else router.push(`/${user.role}`);
    }
  }, [user, router]);

  // BUG 2 FIX: Read ?error= query param set by Google OAuth redirect-on-failure
  useEffect(() => {
    const errorParam = searchParams?.get('error');
    if (errorParam === 'google_failed' && loginState !== 'error') {
      setLoginState('error');
      setError('Google sign-in failed. Please try again or use phone/password.');
    }

    const credParam = searchParams?.get('credential');
    if (credParam && loginState === 'idle') {
      handleGoogleSuccess(credParam);
    }

    if (errorParam || credParam) {
      router.replace('/login', { scroll: false });
    }
  }, [searchParams, router, loginState, handleGoogleSuccess]);

  // Initial client-side checks
  useEffect(() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setLoginState('offline');
    }
  }, []);

  // Session expired detection

  // Offline detection
  useEffect(() => {
    const onOnline  = () => setLoginState((s: LoginState) => s === 'offline' ? 'idle' : s);
    const onOffline = () => setLoginState('offline');
    
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // IP rate-limit countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => {
      setCooldown((c: number) => {
        if (c <= 1) { clearInterval(id); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  // Resend timer
  useEffect(() => {
    if (resendTimer <= 0) return;
    const id = setInterval(() => setResendTimer(s => s - 1), 1000);
    return () => clearInterval(id);
  }, [resendTimer]);

  // Account lockout countdown
  useEffect(() => {
    if (retryAfter <= 0) return;
    const id = setInterval(() => {
      setRetryAfter((r: number) => {
        if (r <= 1) {
          clearInterval(id);
          setLoginState('idle');
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [retryAfter]);

  const handleSendOtp = async () => {
    if (!phone) return;
    setLoginState('loading');
    setError('');
    try {
      await api.post('/auth/phone/send-otp', { phone });
      setOtpStep('verify');
      setResendTimer(60);
      setLoginState('idle');
    } catch (err) {
      setLoginState('error');
      setError('Failed to send OTP. Please try again.');
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) return;
    setLoginState('loading');
    setError('');
    try {
      const res = await api.post('/auth/phone/verify-otp', { phone, otp });
      setLoginState('success');
      await new Promise(r => setTimeout(r, 1000));
      login(res.data.user);
    } catch (err) {
      setLoginState('error');
      setError(t.invalidOtp);
    }
  };

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
      const error = err as ApiError;
      function getFriendlyError(err: ApiError): string {
        if (!navigator.onLine) return 'You appear to be offline.';
        const status = err.response?.status;
        const msg = err.response?.data?.message || '';
        if (status === 401) return 'Incorrect phone number or password.';
        if (status === 403) return 'Your account has been locked. Contact support.';
        if (status === 429) return 'Too many attempts. Please wait and try again.';
        if (status && status >= 500) return 'Server error. Please try again in a moment.';
        if (err.message === 'Network Error') return 'Cannot reach the server. Check your connection.';
        // Only pass through safe, known backend messages
        const safeMsgs = [
          'User not found',
          'Invalid password',
          'Account locked',
          'Invalid phone number or password.',
        ];
        if (safeMsgs.includes(msg)) return msg;
        return 'Login failed. Please try again.';
      }

      if (error.response?.status === 429) {
        setLoginState('locked');
        setRetryAfter(60); // Default to 60s
        setError(getFriendlyError(error));
      } else {
        setLoginState('error');
        setError(getFriendlyError(error));
      }
    }
  };

  const handleDemoFill = (u: string, p: string) => {
    setPhone(u);
    setPassword(p);
    setLoginState('typing');
  };


  return (
    <div className="login-bg flex flex-col items-center justify-center min-h-screen px-4 py-8">
      <div className="login-content w-full max-w-[440px]">
        
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-4">
          <span className="beta-badge">BETA v0.9 (Pre-Launch)</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLang(lang === 'en' ? 'ta' : 'en')}
              className="lang-toggle"
            >
              <Globe className="w-3.5 h-3.5" />
              {t.langToggle}
            </button>
          </div>
        </div>

        {/* Brand */}
        <div className="login-brand text-center mb-8">
          <div className="fish-icon">🌊</div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-0.5">
             {t.loginTitle}
          </h1>
          <p className="text-sm font-medium" style={{ color: 'var(--white-secondary)' }}>
            Digital Ledger for Fishing Agents
          </p>
        </div>

        {/* Card */}
        <div className="login-card p-7">
          <AnimatePresence>
            {loginState === 'offline' && (
              <motion.div 
                className="offline-banner flex items-center gap-2 p-3 text-sm font-semibold mb-5"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <WifiOff className="w-4 h-4" />
                <span>{t.offlineBanner}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {(error || googleError) && (
            <div className="error-banner flex items-center gap-3 p-3.5 text-sm font-semibold mb-5">
              <span className="flex-1">{error || googleError}</span>
              <button onClick={() => { setError(''); clearGoogleError(); }}>✕</button>
            </div>
          )}

          {/* Google */}
          <GoogleAuthButton
            lang={currentLang}
            isLoading={googleLoading}
            isOffline={loginState === 'offline'}
            popupBlocked={popupBlocked}
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
          />

          {/* Login Method Tabs */}
          <div className="flex p-1 bg-white/5 rounded-2xl border border-white/10 mt-6">
            <button
              onClick={() => { setLoginMethod('password'); setLoginState('idle'); }}
              className={`flex-1 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${loginMethod === 'password' ? 'bg-white text-ocean-950 shadow-lg' : 'text-white/40 hover:text-white'}`}
            >
              Password
            </button>
            <button
              onClick={() => { setLoginMethod('otp'); setLoginState('idle'); }}
              className={`flex-1 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${loginMethod === 'otp' ? 'bg-white text-ocean-950 shadow-lg' : 'text-white/40 hover:text-white'}`}
            >
              OTP
            </button>
          </div>

          <div className="flex items-center gap-4 my-6">
            <div className="ocean-divider flex-1" />
            <span className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--white-secondary)' }}>
              {t.dividerOr}
            </span>
            <div className="ocean-divider flex-1" />
          </div>

          <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
            {loginMethod === 'password' ? (
              <>
                {/* Phone */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-widest ml-1" style={{ color: 'var(--white-secondary)' }}>
                    {t.phoneLabel}
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--white-secondary)' }} />
                    <input
                      type="tel"
                      placeholder={t.phonePlaceholder}
                      value={phone}
                      {...getInputProps('phone')}
                      onChange={e => {
                        setPhone(e.target.value.replace(/[^\d+]/g, ''));
                        getInputProps('phone').onChange();
                        if (loginState !== 'typing') setLoginState('typing');
                      }}
                      className={`ocean-input w-full rounded-2xl pl-10 pr-4 font-semibold ${errors.phone ? '!border-red-500 !shadow-[0_0_15px_rgba(239,68,68,0.2)]' : ''}`}
                      style={{ height: '52px' }}
                      required
                    />
                  </div>
                  {errors.phone && (
                    <p id="phone-error" className="text-red-400 text-xs mt-1 ml-1 font-bold animate-in fade-in duration-200">
                      {errors.phone}
                    </p>
                  )}
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--white-secondary)' }}>
                      {t.passwordLabel}
                    </label>
                    <button 
                      type="button" 
                      className="text-[10px] font-black uppercase tracking-widest hover:text-white" 
                      style={{ color: 'var(--teal-glow)' }}
                      onClick={() => router.push('/forgot-password')}
                    >
                      {t.forgotPassword}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--white-secondary)' }} />
                    <input
                      type={showPass ? 'text' : 'password'}
                      placeholder={t.passwordPlaceholder}
                      value={password}
                      {...getInputProps('password')}
                      onChange={e => {
                        setPassword(e.target.value);
                        getInputProps('password').onChange();
                        if (loginState !== 'typing') setLoginState('typing');
                      }}
                      className={`ocean-input w-full rounded-2xl pl-10 pr-12 font-semibold ${errors.password ? '!border-red-500 !shadow-[0_0_15px_rgba(239,68,68,0.2)]' : ''}`}
                      style={{ height: '52px' }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p id="password-error" className="text-red-400 text-xs mt-1 ml-1 font-bold animate-in fade-in duration-200">
                      {errors.password}
                    </p>
                  )}
                </div>
              </>
            ) : (
              /* OTP FLOW */
              <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                {otpStep === 'phone' ? (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase tracking-widest ml-1" style={{ color: 'var(--white-secondary)' }}>
                      {t.phoneLabel}
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--white-secondary)' }} />
                      <input
                        type="tel"
                        placeholder={t.phonePlaceholder}
                        value={phone}
                        onChange={e => setPhone(e.target.value.replace(/[^\d+]/g, ''))}
                        className="ocean-input w-full rounded-2xl pl-10 pr-4 font-semibold"
                        style={{ height: '52px' }}
                        required
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <label className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--white-secondary)' }}>
                        {t.enterOtp}
                      </label>
                      <button 
                        type="button" 
                        className="text-[10px] font-black uppercase" 
                        style={{ color: 'var(--teal-glow)' }}
                        onClick={() => setOtpStep('phone')}
                      >
                         Change Phone
                      </button>
                    </div>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="0 0 0 0 0 0"
                      value={otp}
                      onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                      className="ocean-input w-full rounded-2xl text-center text-2xl tracking-[0.5em] font-black"
                      style={{ height: '64px' }}
                      autoFocus
                    />
                    <div className="flex justify-center">
                      <button
                        type="button"
                        disabled={resendTimer > 0}
                        onClick={handleSendOtp}
                        className="text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
                      >
                        {resendTimer > 0 ? t.resendIn.replace('[s]', String(resendTimer)) : t.resendOtp}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loginState === 'loading' || loginState === 'locked'}
              className="login-btn w-full mt-4 text-white border-0 flex items-center justify-center gap-3"
            >
              {loginState === 'loading' ? (
                <>
                  <div className="wave-bars">
                    {[1,2,3,4,5].map(i => <span key={i} />)}
                  </div>
                  <span className="uppercase tracking-widest font-black">
                    {loginMethod === 'otp' && otpStep === 'phone' ? t.sendOtp : t.loginLoading}
                  </span>
                </>
              ) : loginState === 'locked' ? (
                <>
                  <Clock className="w-4 h-4" />
                  <span className="uppercase tracking-widest font-black">Wait {retryAfter}s</span>
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4" />
                  <span className="uppercase tracking-widest font-black">
                    {loginMethod === 'otp' ? (otpStep === 'phone' ? t.sendOtp : t.loginBtn) : t.loginBtn}
                  </span>
                </>
              )}
            </button>



            {/* Demo user pills */}
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {DEMO_USERS.map(u => (
                <button
                  key={u.username}
                  type="button"
                  onClick={() => handleDemoFill(u.username, u.password)}
                  className="demo-pill text-xs px-3 py-1.5 rounded-full border border-white/20 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all font-semibold"
                >
                  {u.label}
                </button>
              ))}
            </div>

            <div className="text-center mt-5">
              <p className="text-xs font-semibold" style={{ color: 'var(--white-secondary)' }}>
                {t.dontHaveAccount}{' '}
                <Link
                  href="/register"
                  className="text-white hover:underline transition-all font-black"
                  style={{ color: 'var(--teal-glow)' }}
                >
                   {t.createAccount}
                </Link>
              </p>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-6 flex flex-col items-center gap-4">
           <div className="security-badge">
             <Lock className="w-3 h-3" />
             {t.securedBy}
           </div>
        </div>
      </div>

       {/* Role Selection Modal (for Social Signups) */}
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

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="login-bg min-h-screen flex items-center justify-center">
         <div className="wave-bars">
           {[1,2,3,4,5].map(i => <span key={i} />)}
         </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
