"use client";
import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import type { UserRole } from '@/components/shared/RoleSelectModal';

interface GoogleAuthState {
  isLoading: boolean;
  error: string | null;
  popupBlocked: boolean;
  needsRoleSelection: boolean;
  pendingCredential: string | null;
  newUserName: string;
}

interface UseGoogleAuthReturn extends GoogleAuthState {
  handleGoogleSuccess: (credential: string) => Promise<void>;
  handleGoogleError: () => void;
  handleRoleSelect: (role: UserRole) => Promise<void>;
  clearError: () => void;
}

/**
 * Manages the full Google OAuth flow:
 * 1. Receive raw credential token from GoogleLogin component
 * 2. POST /api/auth/google for server-side verification
 * 3. If needsRoleSelection → surface role modal, stash credential
 * 4. After role chosen → POST again with role
 * 5. login() from AuthContext → redirect by role
 */
export function useGoogleAuth(): UseGoogleAuthReturn {
  const { login } = useAuth();
  const [state, setState] = useState<GoogleAuthState>({
    isLoading: false,
    error: null,
    popupBlocked: false,
    needsRoleSelection: false,
    pendingCredential: null,
    newUserName: '',
  });

  const verifyWithBackend = useCallback(
    async (credential: string, role?: UserRole) => {
      const response = await api.post('/auth/google', {
        credential,
        ...(role && { role }),
      });
      return response.data;
    },
    []
  );

  const handleGoogleSuccess = useCallback(
    async (credential: string) => {
      setState(s => ({ ...s, isLoading: true, error: null, popupBlocked: false }));

      try {
        const data = await verifyWithBackend(credential);

        // Backend says this Google email is brand new → show role picker
        if (data.needsRoleSelection) {
          setState(s => ({
            ...s,
            isLoading: false,
            needsRoleSelection: true,
            pendingCredential: credential,
            newUserName: data.name || '',
          }));
          return;
        }

        // Existing user — log in
        login(data.user);
      } catch (err: unknown) {
        const e = err as { message?: string; code?: string };

        // Detect popup-blocked scenario
        if (
          e.message?.includes('popup') ||
          e.code === 'ERR_BLOCKED_BY_CLIENT'
        ) {
          setState(s => ({ ...s, isLoading: false, popupBlocked: true, error: null }));
          return;
        }

        setState(s => ({
          ...s,
          isLoading: false,
          error: 'Google login failed — please try again.',
        }));
      }
    },
    [verifyWithBackend, login]
  );

  const handleGoogleError = useCallback(() => {
    setState(s => ({
      ...s,
      isLoading: false,
      popupBlocked: false,
      // Only set popupBlocked if we detect the specific error;
      // treat all other cases as generic errors
      error: 'Google login failed — please try again.',
    }));
  }, []);

  const handleRoleSelect = useCallback(
    async (role: UserRole) => {
      if (!state.pendingCredential) return;

      setState(s => ({ ...s, isLoading: true, error: null }));

      try {
        const data = await verifyWithBackend(state.pendingCredential, role);
        login(data.user);
      } catch {
        setState(s => ({
          ...s,
          isLoading: false,
          needsRoleSelection: false,
          pendingCredential: null,
          error: 'Failed to complete registration — please try again.',
        }));
      }
    },
    [state.pendingCredential, verifyWithBackend, login]
  );

  const clearError = useCallback(() => {
    setState(s => ({ ...s, error: null, popupBlocked: false }));
  }, []);

  return {
    ...state,
    handleGoogleSuccess,
    handleGoogleError,
    handleRoleSelect,
    clearError,
  };
}
