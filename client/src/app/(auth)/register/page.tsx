"use client";
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Eye, EyeOff, CheckCircle2, User, Phone, Lock, Ship, Store, ChevronRight, ArrowRight, WifiOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import GoogleAuthButton from '../login/_components/GoogleAuthButton';
import RoleSelectModal from '@/components/shared/RoleSelectModal';
import { useFormErrors } from '@/hooks/useFormErrors';
import { loginT } from '@/lib/loginTranslations';
import api from '@/lib/api';
import '../login/login.css';
import { VoiceInput } from '@/components/voice/VoiceInput';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';

type RegisterState = 'idle' | 'loading' | 'success' | 'error';
type UserRole = 'AGENT' | 'OWNER' | 'BUYER';

export default function RegisterPage() {
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('AGENT');
  const [showPass, setShowPass] = useState(false);
  const [state, setState] = useState<RegisterState>('idle');
  const [error, setError] = useState('');
  const [isOffline, setIsOffline] = useState(false);

  const { errors, clearAllErrors, formRef, getInputProps } = useFormErrors();

  const { lang, setLang } = useLanguage();
  const { user, login } = useAuth();
  const router = useRouter();
  
  // Safely resolve translation set
  const currentLang = (lang === 'ta' || lang === 'en') ? lang : 'en';
  const t = loginT[currentLang];

  useEffect(() => { setMounted(true); }, []);

  // Redirect if already logged in (client-side backup to middleware)
  useEffect(() => {
    if (mounted && user) {
      router.push(`/${user.role === 'admin' ? 'owner' : user.role}`);
    }
  }, [mounted, user, router]);

  // Offline detection
  useEffect(() => {
    const onOnline  = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    if (typeof navigator !== 'undefined' && !navigator.onLine) setIsOffline(true);
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

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
  } = useGoogleAuth();

  const handleSuccessFlash = useCallback(async (userData: any) => {
    setState('success');
    await new Promise(r => setTimeout(r, 1200));
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
        role: role.toUpperCase() 
      });
      await handleSuccessFlash(res.data.user);
    } catch (err: any) {
      setState('error');
      setError(err.response?.data?.message || 'Registration failed. Try again.');
    }
  };

  if (!mounted) {
    return (
      <div className="login-bg min-h-screen flex items-center justify-center">
         <div className="wave-bars">
           {[1,2,3,4,5].map(i => <span key={i} />)}
         </div>
      </div>
    );
  }

  return (
    <div className="login-bg flex flex-col items-center justify-center min-h-screen px-4 py-10">
      <div className="login-content w-full max-w-[440px]">
        
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-8">
          <span className="beta-badge">JOIN US</span>
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
          <h1 className="text-3xl font-black text-white tracking-tight mb-1">
            {t.createAccount}
          </h1>
          <p className="text-sm font-medium" style={{ color: 'var(--white-secondary)' }}>
            Start your digital ledger journey
          </p>
        </div>

        {/* Card */}
        <div className="login-card p-7 relative">
          <VoiceInput 
            variant="card-integrated"
            lang={currentLang} 
            onParsedResult={(res) => {
              res.forEach(item => {
                if (item.command === 'save') {
                  const btn = document.querySelector('button[type="submit"]') as HTMLButtonElement;
                  btn?.click();
                }
              });
            }} 
          />
          <AnimatePresence>
            {isOffline && (
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

          <AnimatePresence>
            {state === 'success' && (
              <motion.div className="success-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="success-check">
                  <CheckCircle2 className="w-10 h-10" style={{ color: 'var(--success-green)' }} />
                </div>
                <h2 className="text-xl font-black text-white">Welcome Aboard!</h2>
                <p className="text-sm text-center" style={{ color: 'var(--white-secondary)' }}>Account created successfully.</p>
              </motion.div>
            )}
          </AnimatePresence>

          {(error || googleError) && (
            <div className="error-banner flex items-center gap-3 p-3.5 text-sm font-semibold mb-5">
              <span className="flex-1">{error || googleError}</span>
              <button onClick={() => { setError(''); }}>✕</button>
            </div>
          )}

          {/* Google */}
          <GoogleAuthButton
            lang={currentLang}
            isLoading={googleLoading}
            isOffline={isOffline}
            popupBlocked={popupBlocked}
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
          />

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="ocean-divider flex-1" />
            <span className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--white-secondary)' }}>
              {t.dividerOr}
            </span>
            <div className="ocean-divider flex-1" />
          </div>

          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
            {/* Role Selection */}
            <div className="space-y-2 pb-2">
              <label className="text-[11px] font-black uppercase tracking-widest ml-1" style={{ color: 'var(--white-secondary)' }}>
                {t.selectRole}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('AGENT')}
                  className={`flex items-center justify-center gap-3 p-4 rounded-2xl border transition-all ${role === 'AGENT' ? 'bg-ocean-surface border-teal-glow shadow-lg shadow-teal-500/20' : 'bg-ocean-deep border-white/5 opacity-60'}`}
                >
                  <User className={`w-5 h-5 ${role === 'AGENT' ? 'text-teal-glow' : 'text-white'}`} />
                  <span className="text-xs font-black uppercase tracking-tight">{t.roleAgent}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('OWNER')}
                  className={`flex items-center justify-center gap-3 p-4 rounded-2xl border transition-all ${role === 'OWNER' ? 'bg-ocean-surface border-teal-glow shadow-lg shadow-teal-500/20' : 'bg-ocean-deep border-white/5 opacity-60'}`}
                >
                  <Ship className={`w-5 h-5 ${role === 'OWNER' ? 'text-teal-glow' : 'text-white'}`} />
                  <span className="text-xs font-black uppercase tracking-tight">{t.roleOwner}</span>
                </button>
              </div>
            </div>

            {/* Name */}
            <div className="relative">
              <User className="absolute left-4 top-[44px] -translate-y-1/2 w-4 h-4 z-10" style={{ color: 'var(--white-secondary)' }} />
              <Input
                label={t.fullName}
                placeholder={t.fullNamePlaceholder}
                value={name}
                {...getInputProps('name')}
                onChange={e => {
                  setName(e.target.value);
                  getInputProps('name').onChange();
                }}
                className={`pl-10 font-semibold ${errors.name ? '!border-red-500 !shadow-[0_0_15px_rgba(239,68,68,0.2)]' : ''}`}
                style={{ height: '52px' }}
                required
              />
            </div>

            {/* Phone */}
            <div className="relative">
              <Phone className="absolute left-4 top-[44px] -translate-y-1/2 w-4 h-4 z-10" style={{ color: 'var(--white-secondary)' }} />
              <Input
                label={t.phoneLabel}
                type="tel"
                placeholder={t.phonePlaceholder}
                value={phone}
                {...getInputProps('phone')}
                onChange={e => {
                  setPhone(e.target.value.replace(/[^\d+]/g, ''));
                  getInputProps('phone').onChange();
                }}
                className={`pl-10 font-semibold ${errors.phone ? '!border-red-500 !shadow-[0_0_15px_rgba(239,68,68,0.2)]' : ''}`}
                style={{ height: '52px' }}
                required
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-4 top-[44px] -translate-y-1/2 w-4 h-4 z-10" style={{ color: 'var(--white-secondary)' }} />
              <Input
                label={t.passwordLabel}
                type={showPass ? 'text' : 'password'}
                placeholder={t.passwordPlaceholder}
                value={password}
                {...getInputProps('password')}
                onChange={e => {
                  setPassword(e.target.value);
                  getInputProps('password').onChange();
                }}
                className={`pl-10 pr-12 font-semibold ${errors.password ? '!border-red-500 !shadow-[0_0_15px_rgba(239,68,68,0.2)]' : ''}`}
                style={{ height: '52px' }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-4 top-[44px] -translate-y-1/2 text-white/40 hover:text-white z-10"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={state === 'loading'}
              className="login-btn w-full mt-4 text-white border-0 flex items-center justify-center gap-3"
            >
              {state === 'loading' ? (
                <div className="wave-bars">
                  {[1,2,3,4,5].map(i => <span key={i} />)}
                </div>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4" />
                  <span className="uppercase tracking-widest font-black">{t.registerBtn}</span>
                </>
              )}
            </button>

            <div className="text-center mt-6">
              <p className="text-xs font-semibold" style={{ color: 'var(--white-secondary)' }}>
                {t.alreadyHaveAccount}{' '}
                {/* BUG 3 FIX: Use router.push (Next.js SPA navigation) instead of
                    window.location.href which causes a full page reload. */}
                <button
                  type="button"
                  onClick={() => router.push('/login')}
                  className="text-white hover:underline transition-all font-black"
                  style={{ color: 'var(--teal-glow)' }}
                >
                  {t.loginBtn}
                </button>
              </p>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-8 flex justify-center gap-6">
           <div className="security-badge">
             <Lock className="w-3 h-3" />
             {t.securedBy}
           </div>
        </div>
      </div>

      {/* Role Selection Modal (for Google Signups) */}
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
