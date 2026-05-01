"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { ApiError, User } from '@fishmarket/shared-types';

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
    const hasHydrated = React.useRef(false);
    useEffect(() => {
        if (hasHydrated.current) return;
        hasHydrated.current = true;

        const verifySession = async () => {
            try {
                const res = await api.get('/auth/me');
                // Cookie is valid — sync the authoritative user from the server.
                const freshUser: User = res.data.user;
                setUser(freshUser);
                localStorage.setItem('user', JSON.stringify(freshUser));
            } catch (err) {
                const error = err as ApiError;
                if (error.response?.status === 401) {
                    // Cookie is expired — clear stale state including the middleware role cookie.
                    localStorage.removeItem('user');
                    localStorage.removeItem('token');
                    document.cookie = 'fm_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
                    setUser(null);
                }
            } finally {
                setIsLoading(false);
            }
        };

        void verifySession();
    }, []);

    // ── Safe Redirection Guard ──────────────────────────────────────────────
    const [shouldRedirectToLogin, setShouldRedirectToLogin] = useState(false);

    useEffect(() => {
        if (shouldRedirectToLogin && !isLoading) {
            router.push('/login?reason=session-expired');
            setShouldRedirectToLogin(false);
        }
    }, [shouldRedirectToLogin, isLoading, router]);


    // ── FIX 1 (client side): Listen for the auth:unauthorized event ─────────
    useEffect(() => {
        const handleUnauthorized = () => {
            // Only redirect if we actually had a user (prevents infinite loops on login page)
            setUser((currentUser) => {
                if (!currentUser) return null;
                
                // Clear state synchronously here
                localStorage.removeItem('user');
                localStorage.removeItem('token');
                document.cookie = 'fm_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
                
                // Return null to update the state
                return null;
            });

            // Signal that we need to redirect
            setShouldRedirectToLogin(true);
        };

        window.addEventListener('auth:unauthorized', handleUnauthorized);
        return () =>
            window.removeEventListener('auth:unauthorized', handleUnauthorized);
    }, []);

    const login = (userData: User) => {
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);

        // Sync role to a non-HttpOnly cookie for Next.js middleware route protection.
        if (typeof window !== 'undefined') {
            const role = userData.role.toLowerCase();
            const secure = window.location.protocol === 'https:' ? '; Secure' : '';
            document.cookie = `fm_role=${role}; path=/; max-age=86400; SameSite=Lax${secure}`;
        }

        const role = userData.role.toLowerCase();
        if (role === 'owner' || role === 'admin') router.push('/owner');
        else if (role === 'agent') router.push('/agent');
        else if (role === 'buyer') router.push('/customer');
        else router.push(`/${role}`);
    };

    const logout = async () => {
        try {
            await api.post('/auth/logout');
        } catch (err) {
            console.error('Logout failed on server', err instanceof Error ? err.message : err);
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
