import React, { useState, useEffect } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { Loader2, WifiOff } from 'lucide-react';
import { T as loginT } from '@/lib/i18n';
import type { Language } from '@/lib/i18n';

interface GoogleAuthButtonProps {
  lang: Language;
  isLoading: boolean;
  isOffline: boolean;
  popupBlocked: boolean;
  onSuccess: (credential: string) => void;
  onError: () => void;
}

/**
 * Wraps @react-oauth/google's GoogleLogin component.
 * Detects PWA standalone mode → uses redirect flow to avoid popup blocks on Android.
 * Shows loading spinner overlay when `isLoading` is true.
 */
export default function GoogleAuthButton({
  lang,
  isLoading,
  isOffline,
  popupBlocked,
  onSuccess,
  onError,
}: GoogleAuthButtonProps) {
  const t = loginT[lang];
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTimeout(() => { setMounted(true); }, 0);
  }, []);

  // Strictly use popup mode; redirect requires a backend callback endpoint.

  const handleSuccess = (response: { credential?: string }) => {
    if (response.credential) {
      onSuccess(response.credential);
    } else {
      onError();
    }
  };

  if (!mounted) return null;

  if (isOffline) {
    return (
      <div className="offline-banner flex items-center gap-3 p-3.5 text-sm font-semibold">
        <WifiOff className="w-4 h-4 flex-shrink-0" />
        <span>{t.offlineBanner}</span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        id="google-btn-loading"
        className="google-btn w-full flex items-center justify-center gap-3 cursor-not-allowed"
        style={{ height: 48 }}
      >
        <Loader2 size={18} style={{ color: 'var(--clr-primary)', animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--clr-primary)' }}>{t.googleVerifying}</span>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Native Google button — full OAuth flow */}
      <div
        id="google-oauth-btn"
        className="google-btn"
        style={{ width: '100%', minHeight: 48 }}
      >
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={onError}
          useOneTap={false}
          type="standard"
          theme="outline"
          shape="rectangular"
          size="large"
          text="signin_with"
          ux_mode="popup"
          width="380"
        />
      </div>

      {/* Popup-blocked warning shown below button */}
      {popupBlocked && (
        <div
          id="popup-blocked-banner"
          className="popup-banner flex items-center gap-2 p-3 text-xs font-semibold mt-2"
        >
          <span>⚠️</span>
          <span>{t.allowPopups}</span>
        </div>
      )}
    </div>
  );
}
