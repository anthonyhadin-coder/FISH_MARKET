import axios from 'axios';
import { showToast } from '@/components/ui/Toast';

const api = axios.create({
    baseURL: (typeof window !== 'undefined' && (window as { __PLAYWRIGHT_TEST__?: boolean }).__PLAYWRIGHT_TEST__)
        ? '/api'
        : (process.env.NEXT_PUBLIC_API_URL || ''),
    // Auth is handled entirely via HttpOnly cookies — no Bearer tokens needed.
    // The withCredentials flag ensures cookies are sent on every cross-origin request.
    withCredentials: true,
});

// ── Request Interceptor (Offline Check) ────────────────────────────────────────
api.interceptors.request.use((config) => {
    if (typeof window !== 'undefined' && !navigator.onLine) {
        // Break early if we know we are offline. Ensures offline mechanisms trigger instantly
        // and prevents Playwright mock interceptors from wrongly returning 200 OKs.
        const error = new Error('Network error: Browser is offline') as Error & { code?: string };
        error.code = 'ERR_NETWORK';
        return Promise.reject(error);
    }
    return config;
});

// ── Response Interceptor ───────────────────────────────────────────────────────
// Module-level variable to deduplicate concurrent refresh attempts.
// If multiple 401s happen at once, they all await this same promise.
let refreshPromise: Promise<unknown> | null = null;

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const status = error?.response?.status;
        const originalRequest = error.config;

        // 401 → attempt silent token refresh first (unless it's an authentication endpoint itself)
        const isAuthEndpoint = originalRequest?.url?.match(/\/auth\/(login|register|google|refresh)/);
        if (status === 401 && originalRequest && !originalRequest._retry && !isAuthEndpoint) {
            originalRequest._retry = true;

            if (!refreshPromise) {
                // First 401 to land starts the refresh process
                refreshPromise = api.post('/auth/refresh')
                    .finally(() => {
                        refreshPromise = null;
                    });
            }

            try {
                await refreshPromise;
                return api(originalRequest); // retry original request
            } catch (refreshError: unknown) {
                // Refresh failed OR refresh itself returned "Token is not valid" 
                // Notify AuthContext to redirect cleanly
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
                }
                return Promise.reject(refreshError);
            }
        }

        // If we get an explicit 'Token is not valid' from the server (not just expired)
        // we must not retry; just redirect immediately.
        if (status === 401 && error.response?.data?.message === 'Token is not valid') {
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('auth:unauthorized'));
            }
            return Promise.reject(error);
        }

        // ── Specific toast messages for validation errors ──────
        if (status === 400 && error.response?.data?.errors) {
            const errors: Array<{ field: string; message: string }> = error.response.data.errors;
            const labels = errors.map((e) => `${capitalise(e.field)}: ${e.message}`);
            const MAX_SHOWN = 3;
            const shown = labels.slice(0, MAX_SHOWN);
            const remaining = labels.length - MAX_SHOWN;
            const toastMsg =
                remaining > 0
                    ? `${shown.join(' · ')} …and ${remaining} more error${remaining > 1 ? 's' : ''}`
                    : shown.join(' · ');

            showToast(toastMsg, 'error');

            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('api:form-errors', { detail: errors }));
            }
            return Promise.reject(error);
        }

        // Map status codes to localized i18n keys from src/lib/i18n.ts
        const errorKey = 
            !error.response ? 'connectionError' :
            status === 401 ? 'sessionExpired' :
            status === 403 ? 'unauthorized' :
            status >= 500 ? 'serverError' :
            null;

        // Attach both the key and a fallback raw message
        error.errorKey = errorKey;
        const rawMsg = error.response?.data?.message || 'An unexpected error occurred.';
        
        // Hide technical JWT errors from users
        error.friendlyMessage = (rawMsg === 'Token is not valid' || rawMsg === 'jwt malformed' || rawMsg === 'invalid token')
            ? 'Session expired. Please log in again.'
            : rawMsg;

        // ── Handle Rate Limits (429) ───────────────────────────
        if (status === 429 && originalRequest && !originalRequest._rateRetry) {
            originalRequest._rateRetry = true;
            originalRequest.retryCount = (originalRequest.retryCount || 0) + 1;

            if (originalRequest.retryCount <= 3) {
                // Exponential backoff with jitter
                const delay = Math.pow(2, originalRequest.retryCount) * 1000 + Math.random() * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
                return api(originalRequest);
            }
        }

        return Promise.reject(error);
    }
);

// Helper — capitalises the first letter of a field name for display
function capitalise(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

export default api;
