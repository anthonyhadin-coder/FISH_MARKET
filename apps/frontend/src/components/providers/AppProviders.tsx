"use client";

import React from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ToastProvider } from '@fishmarket/ui';
import { StableGoogleAuthProvider } from '@/components/providers/GoogleAuthProvider';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

interface AppProvidersProps {
  children: React.ReactNode;
  googleClientId?: string;
}

export function AppProviders({ children, googleClientId }: AppProvidersProps) {
  const [queryClient] = React.useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchOnWindowFocus: false,
      }
    }
  }));

  const inner = (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <ToastProvider>
            <>{children}</>
          </ToastProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );

  return googleClientId ? (
    <StableGoogleAuthProvider clientId={googleClientId}>
      {inner}
    </StableGoogleAuthProvider>
  ) : (
    inner
  );
}
