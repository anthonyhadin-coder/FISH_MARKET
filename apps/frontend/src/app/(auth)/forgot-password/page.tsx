"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, Lock, KeyRound, ArrowRight, ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import { showToast } from '@/components/ui/Toast';
import { ApiError } from '@fishmarket/shared-types';
import '../login/login.css';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  // Resend OTP countdown
  useEffect(() => {
    if (resendTimer <= 0) return;
    const id = setInterval(() => setResendTimer(s => s - 1), 1000);
    return () => clearInterval(id);
  }, [resendTimer]);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { phone });
      showToast('OTP sent successfully', 'success');
      setStep(2);
      setResendTimer(60);
    } catch (err: unknown) {
      const error = err as ApiError;
      showToast(error.response?.data?.message || 'Failed to send OTP', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const res = await api.post('/auth/verify-otp', { phone, otp });
      setResetToken(res.data.resetToken);
      showToast('OTP verified', 'success');
      setStep(3);
    } catch (err: unknown) {
      const error = err as ApiError;
      showToast(error.response?.data?.message || 'Invalid OTP', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { resetToken, newPassword });
      showToast('Password reset successfully. You can now log in.', 'success');
      router.push('/login');
    } catch (err: unknown) {
      const error = err as ApiError;
      showToast(error.response?.data?.message || 'Failed to reset password', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main id="main-content" className="login-bg flex flex-col items-center justify-center min-h-screen px-4 py-8">
      <div className="login-content w-full max-w-[440px]">
        <button
          onClick={() => router.push('/login')}
          className="flex items-center gap-2 text-white/50 hover:text-white mb-6 font-semibold uppercase tracking-widest text-[11px]"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Login
        </button>

        <div className="login-brand text-center mb-8">
          <div className="fish-icon">🔑</div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-1">
            Reset Password
          </h1>
          <p className="text-sm font-medium" style={{ color: 'var(--white-secondary)' }}>
            {step === 1 && 'Enter your registered phone number'}
            {step === 2 && 'Enter the 6-digit OTP sent to your phone'}
            {step === 3 && 'Create a new, secure password'}
          </p>
        </div>

        <div className="login-card p-7">
          {step === 1 && (
            <form onSubmit={handleRequestOtp} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-widest ml-1" style={{ color: 'var(--white-secondary)' }}>Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                  <input
                    type="tel"
                    placeholder="Enter phone..."
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/[^\d+]/g, ''))}
                    className="ocean-input w-full rounded-2xl pl-10 pr-4 font-semibold h-[52px]"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="login-btn w-full text-white border-0 flex items-center justify-center gap-3 mt-4"
              >
                {loading ? 'Sending...' : 'Send OTP'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-widest ml-1" style={{ color: 'var(--white-secondary)' }}>Enter OTP</label>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    placeholder="6-digit code"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="ocean-input w-full rounded-2xl pl-10 pr-4 font-semibold tracking-widest text-lg h-[52px]"
                    required
                    maxLength={6}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="login-btn w-full text-white border-0 flex items-center justify-center gap-3 mt-4"
              >
                {loading ? 'Verifying...' : 'Verify OTP'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
              {/* Resend OTP */}
              <div className="flex justify-center mt-3">
                <button
                  type="button"
                  disabled={resendTimer > 0 || loading}
                  onClick={async () => {
                    if (resendTimer > 0 || loading) return;
                    setLoading(true);
                    try {
                      await api.post('/auth/forgot-password', { phone });
                      showToast('OTP resent successfully', 'success');
                      setResendTimer(60);
                    } catch (err: unknown) {
                      const error = err as ApiError;
                      showToast(error.response?.data?.message || 'Failed to resend OTP', 'error');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="text-xs font-bold text-cyan-400 disabled:opacity-40 uppercase tracking-wide"
                >
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-widest ml-1" style={{ color: 'var(--white-secondary)' }}>New Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                  <input
                    type="password"
                    placeholder="Minimum 8 characters"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="ocean-input w-full rounded-2xl pl-10 pr-4 font-semibold h-[52px]"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-widest ml-1" style={{ color: 'var(--white-secondary)' }}>Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                  <input
                    type="password"
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="ocean-input w-full rounded-2xl pl-10 pr-4 font-semibold h-[52px]"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="login-btn w-full text-white border-0 flex items-center justify-center gap-3 mt-4"
              >
                {loading ? 'Resetting...' : 'Reset Password'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
