"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { ApiError, User } from '@fishmarket/shared-types';
import { clearAuthState, formatAuthError } from '@/lib/authUtils';

interface AuthContextType {
    user: User | null;
    login: (user: User) => void;
    logout: () => void;
    isLoading: boolean;
    error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('user');
            try {
                return stored ? JSON.parse(stored) : null;
            } catch {
                return null;
            }
        }
        return null;
    });

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    // Hydrate session on first load.
    // _retry: true tells the interceptor to skip the silent refresh attempt on 401
    // during hydration — we have no session yet, so refresh would fail too and just adds latency.
    const hydrateSession = useCallback(async () => {
        try {
            const res = await api.get('/auth/me', { _retry: true } as Parameters<typeof api.get>[1] & { _retry?: boolean });
            const freshUser: User = res.data.user;
            setUser(freshUser);
            localStorage.setItem('user', JSON.stringify(freshUser));
            setError(null);
        } catch (err) {
            const apiError = err as ApiError;
            const status = apiError.response?.status;
            if (status === 401) {
                // Session expired or no session — clear stale state
                clearAuthState();
                setUser(null);
                setError(null); // Not an error to display, just not logged in
            } else {
                // Network error or server error — keep localStorage user as fallback
                console.warn('Session hydration failed:', apiError.message);
                setError(formatAuthError(apiError));
            }
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Session hydration on first mount
    const hasHydrated = React.useRef(false);
    useEffect(() => {
        if (hasHydrated.current) return;
        hasHydrated.current = true;
        void hydrateSession();
    }, [hydrateSession]);

    // Handle unauthorized events
    useEffect(() => {
        const handleUnauthorized = () => {
            setUser((currentUser) => {
                if (!currentUser) return null;
                clearAuthState();
                return null;
            });
            setError('Session expired');
        };

        window.addEventListener('auth:unauthorized', handleUnauthorized);
        return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
    }, []);

    const login = useCallback((userData: User) => {
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
        setError(null);

        // Sync role to non-HttpOnly cookie for middleware
        if (typeof window !== 'undefined') {
            const role = userData.role.toLowerCase();
            const secure = window.location.protocol === 'https:' ? '; Secure' : '';
            document.cookie = `fm_role=${role}; path=/; max-age=604800; SameSite=Lax${secure}`;
        }

        // Redirect based on role - use setTimeout to avoid navigation during render
        const role = userData.role.toLowerCase();
        setTimeout(() => {
            if (role === 'owner' || role === 'admin') router.push('/owner');
            else if (role === 'agent') router.push('/agent');
            else if (role === 'buyer') router.push('/marketplace');
            else router.push(`/${role}`);
        }, 0);
    }, [router]);

    const logout = useCallback(async () => {
        try {
            await api.post('/auth/logout');
        } catch (err) {
            console.error('Logout failed on server', err instanceof Error ? err.message : err);
        }

        clearAuthState();
        setUser(null);
        setError(null);
        router.push('/login');
    }, [router]);

    const value = { user, login, logout, isLoading, error };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
};
