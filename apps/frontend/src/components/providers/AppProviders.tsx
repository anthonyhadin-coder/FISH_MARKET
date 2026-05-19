"use client";

import React from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ToastProvider } from '@/components/ui/Toast';
import { StableGoogleAuthProvider } from '@/components/providers/GoogleAuthProvider';

interface AppProvidersProps {
  children: React.ReactNode;
  googleClientId?: string;
}

export function AppProviders({ children, googleClientId }: AppProvidersProps) {
  const inner = (
    <LanguageProvider>
      <AuthProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </AuthProvider>
    </LanguageProvider>
  );

  return googleClientId ? (
    <StableGoogleAuthProvider clientId={googleClientId}>
      {inner}
    </StableGoogleAuthProvider>
  ) : (
    inner
  );
}
