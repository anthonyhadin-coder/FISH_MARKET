"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, Lock, KeyRound, ArrowRight, ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import { showToast } from '@/components/ui/Toast';
import { ApiError } from '@fishmarket/shared-types';

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
    <AuthLayout lang="en">
      <AuthCard>
        <button
          onClick={() => router.push('/login')}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 mb-8 font-semibold uppercase tracking-wider text-xs transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Login
        </button>

        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
            Reset Password
          </h2>
          <p className="text-slate-500 text-sm font-medium">
            {step === 1 && 'Enter your registered phone number'}
            {step === 2 && 'Enter the 6-digit OTP sent to your phone'}
            {step === 3 && 'Create a new, secure password'}
          </p>
        </div>

        {step === 1 && (
          <form onSubmit={handleRequestOtp} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700 tracking-tight">Phone Number</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="tel"
                  placeholder="Enter phone..."
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/[^\d+]/g, ''))}
                  className="block w-full h-12 md:h-14 pl-11 pr-4 bg-slate-50 border border-slate-200 focus:border-ocean-500 focus:ring-ocean-500 rounded-xl text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-opacity-20 transition-all sm:text-sm"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className={`w-full h-12 md:h-14 mt-4 flex items-center justify-center gap-2 rounded-xl text-sm font-bold uppercase tracking-wider text-white transition-all transform active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ocean-600 shadow-md ${
                loading
                  ? 'bg-ocean-500 shadow-none cursor-wait'
                  : 'bg-ocean-600 hover:bg-ocean-700 hover:shadow-lg'
              }`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>SENDING...</span>
                </>
              ) : (
                <>
                  <span>SEND OTP</span>
                  <ArrowRight className="h-5 w-5 opacity-90" />
                </>
              )}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700 tracking-tight">Enter OTP</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <KeyRound className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  placeholder="6-digit code"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="block w-full h-14 md:h-16 pl-11 pr-4 text-center tracking-[0.5em] text-2xl font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-ocean-500 focus:ring-2 focus:ring-ocean-500 focus:ring-opacity-20 transition-all"
                  required
                  maxLength={6}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className={`w-full h-12 md:h-14 mt-4 flex items-center justify-center gap-2 rounded-xl text-sm font-bold uppercase tracking-wider text-white transition-all transform active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ocean-600 shadow-md ${
                loading
                  ? 'bg-ocean-500 shadow-none cursor-wait'
                  : 'bg-ocean-600 hover:bg-ocean-700 hover:shadow-lg'
              }`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>VERIFYING...</span>
                </>
              ) : (
                <>
                  <span>VERIFY OTP</span>
                  <ArrowRight className="h-5 w-5 opacity-90" />
                </>
              )}
            </button>
            {/* Resend OTP */}
            <div className="flex justify-center mt-4">
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
                className={`text-xs font-bold uppercase tracking-wider transition-all ${resendTimer > 0 || loading ? 'text-slate-400 cursor-not-allowed' : 'text-ocean-600 hover:text-ocean-700 cursor-pointer'}`}
              >
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleResetPassword} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700 tracking-tight">New Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  placeholder="Minimum 8 characters"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="block w-full h-12 md:h-14 pl-11 pr-4 bg-slate-50 border border-slate-200 focus:border-ocean-500 focus:ring-ocean-500 rounded-xl text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-opacity-20 transition-all sm:text-sm"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700 tracking-tight">Confirm Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="block w-full h-12 md:h-14 pl-11 pr-4 bg-slate-50 border border-slate-200 focus:border-ocean-500 focus:ring-ocean-500 rounded-xl text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-opacity-20 transition-all sm:text-sm"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className={`w-full h-12 md:h-14 mt-4 flex items-center justify-center gap-2 rounded-xl text-sm font-bold uppercase tracking-wider text-white transition-all transform active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ocean-600 shadow-md ${
                loading
                  ? 'bg-ocean-500 shadow-none cursor-wait'
                  : 'bg-ocean-600 hover:bg-ocean-700 hover:shadow-lg'
              }`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>RESETTING...</span>
                </>
              ) : (
                <>
                  <span>RESET PASSWORD</span>
                  <ArrowRight className="h-5 w-5 opacity-90" />
                </>
              )}
            </button>
          </form>
        )}
      </AuthCard>
    </AuthLayout>
  );
}

import AuthLayout from '@/components/auth/AuthLayout';
import AuthCard from '@/components/auth/AuthCard';
