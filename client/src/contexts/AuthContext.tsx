"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface User {
    id: string;
    name: string;
    role: 'owner' | 'agent' | 'buyer' | 'admin' | 'viewer';
    language?: string;
}

interface AuthContextType {
    user: User | null;
    login: (user: User) => void;
    logout: () => void;
    // FIX 4: isLoading is true while we verify the session with GET /api/auth/me.
    // Components should render a splash screen rather than the authenticated UI
    // while this is pending, preventing a "logged-in flash" when the cookie is expired.
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    // Seed from localStorage ONLY as an optimistic initial value.
    // The /api/auth/me check below will correct it if the cookie has expired.
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

    // FIX 4: Start in loading=true so the app does NOT render the authenticated
    // UI before the server has confirmed the session is valid.
    const [isLoading, setIsLoading] = useState(true);

    const router = useRouter();

    // ── FIX 4: Session hydration on first mount ──────────────────────────────
    // Silently verify whether the HttpOnly access_token cookie is still valid.
    // This catches the case where the cookie expired between page loads while
    // the user object was still sitting in localStorage.
    useEffect(() => {
        const verifySession = async () => {
            try {
                const res = await api.get('/auth/me');
                // Cookie is valid — sync the authoritative user from the server.
                const freshUser: User = res.data.user;
                setUser(freshUser);
                localStorage.setItem('user', JSON.stringify(freshUser));
            } catch (err: any) {
                if (err.response?.status === 401) {
                    // Cookie is expired or invalid — clear stale client state.
                    // The axios-auth-refresh interceptor already attempted a
                    // refresh; if we're here it means even the refresh failed.
                    localStorage.removeItem('user');
                    localStorage.removeItem('token');
                    setUser(null);
                }
                // For network errors (offline) we leave the cached user in place
                // so the app stays usable offline — no redirect.
            } finally {
                setIsLoading(false);
            }
        };

        verifySession();
    }, []);

    // ── FIX 1 (client side): Listen for the auth:unauthorized event ─────────
    // Dispatched by api.ts when the refresh token is also expired.
    // Using router.push() here keeps the SPA alive — no full-page reload.
    useEffect(() => {
        const handleUnauthorized = () => {
            setUser(null);
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            router.push('/login?reason=session-expired');
        };

        window.addEventListener('auth:unauthorized', handleUnauthorized);
        return () =>
            window.removeEventListener('auth:unauthorized', handleUnauthorized);
    }, [router]);

    const login = (userData: User) => {
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);

        // Sync role to a non-HttpOnly cookie for Next.js middleware route protection.
        if (typeof window !== 'undefined') {
            document.cookie = `fm_role=${userData.role}; path=/; max-age=86400; SameSite=Lax`;
        }

        if (userData.role === 'owner') router.push('/owner');
        else if (userData.role === 'agent') router.push('/staff');
        else if (userData.role === 'buyer') router.push('/customer');
        else router.push('/viewer');
    };

    const logout = async () => {
        try {
            await api.post('/auth/logout');
        } catch (e) {
            console.error('Logout failed on server', e);
        }

        localStorage.removeItem('user');
        localStorage.removeItem('token');

        // Clear client-visible cookies (HttpOnly ones are cleared by the server).
        if (typeof window !== 'undefined') {
            document.cookie =
                'fm_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
            document.cookie =
                'fm_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';

            // CLEANUP 8: Purge the API cache from the service worker so
            // sensitive data (balances, reports) is not stored on disk after logout.
            if ('caches' in window) {
                caches.delete('api-cache').catch(() => {});
            }
        }

        setUser(null);
        router.push('/login');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
};
