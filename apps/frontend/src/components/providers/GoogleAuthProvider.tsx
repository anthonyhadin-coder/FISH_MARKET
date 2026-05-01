"use client";

import React, { useState, useEffect } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';

interface StableGoogleAuthProviderProps {
  children: React.ReactNode;
  clientId: string;
}



export function StableGoogleAuthProvider({ children, clientId }: StableGoogleAuthProviderProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Return children directly if not mounted yet (SSR) or if already initialized elsewhere
  // But wait, useGoogleLogin depends on the context. 
  // The warning happens because the lib calls initialize on mount.
  // We strictly render the Provider only ONCE.
  
  return (
    <div suppressHydrationWarning>
      {mounted ? (
        <GoogleOAuthProvider clientId={clientId}>
          {children}
        </GoogleOAuthProvider>
      ) : (
        <>{children}</>
      )}
    </div>
  );
}
