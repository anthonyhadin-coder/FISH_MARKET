"use client";

import React, { useState, useEffect } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';

interface StableGoogleAuthProviderProps {
  children: React.ReactNode;
  clientId: string;
}



export function StableGoogleAuthProvider({ children, clientId }: StableGoogleAuthProviderProps) {
  return (
    <GoogleOAuthProvider clientId={clientId}>
      {children}
    </GoogleOAuthProvider>
  );
}
