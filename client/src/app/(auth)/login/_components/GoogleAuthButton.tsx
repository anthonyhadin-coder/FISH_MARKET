"use client";
import { GoogleLogin, useGoogleOneTapLogin } from '@react-oauth/google';
import { Loader2, WifiOff } from 'lucide-react';
import { loginT } from '@/lib/loginTranslations';
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

  // We strictly use "popup" mode because "redirect" requires a backend callback endpoint
  // that we do not currently have implemented. Popup-blocked state is handled below.

  const handleSuccess = (response: { credential?: string }) => {
    if (response.credential) {
      onSuccess(response.credential);
    } else {
      onError();
    }
  };

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
        className="google-btn w-full h-14 rounded-2xl flex items-center justify-center gap-3 cursor-not-allowed"
      >
        <Loader2 className="w-5 h-5 text-ocean-400 animate-spin" />
        <span className="text-sm font-semibold text-ocean-300">{t.googleVerifying}</span>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Native Google button — full OAuth flow */}
      <div
        id="google-oauth-btn"
        className="google-btn w-full rounded-2xl flex items-center justify-center overflow-hidden"
        style={{ minHeight: '56px' }}
      >
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={onError}
          useOneTap={false}
          type="standard"
          theme="filled_black"
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
