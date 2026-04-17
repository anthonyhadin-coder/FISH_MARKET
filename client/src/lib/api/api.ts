import axios from 'axios';
import { showToast } from '@/components/ui/Toast';

const api = axios.create({
    baseURL: (typeof window !== 'undefined' && (window as any).__PLAYWRIGHT_TEST__)
        ? '/api'
        : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'),
    // Auth is handled entirely via HttpOnly cookies — no Bearer tokens needed.
    // The withCredentials flag ensures cookies are sent on every cross-origin request.
    withCredentials: true,
});

// ── Request Interceptor (Offline Check) ────────────────────────────────────────
api.interceptors.request.use((config) => {
    if (typeof window !== 'undefined' && !navigator.onLine) {
        // Break early if we know we are offline. Ensures offline mechanisms trigger instantly
        // and prevents Playwright mock interceptors from wrongly returning 200 OKs.
        const error = new Error('Network error: Browser is offline');
        (error as any).code = 'ERR_NETWORK';
        return Promise.reject(error);
    }
    return config;
});

// ── Response Interceptor ───────────────────────────────────────────────────────
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const status = error?.response?.status;
        const originalRequest = error.config;

        // 401 → attempt silent token refresh first
        if (status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
                await api.post('/auth/refresh');
                return api(originalRequest); // retry original request
            } catch (refreshError) {
                // Refresh failed — kick to login cleanly
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
                }
                return Promise.reject(refreshError);
            }
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

        // Map status codes to user-facing messages
        const friendlyMessage =
            !error.response ? 'You appear to be offline.' :
            status === 401 ? 'Your session expired. Please log in again.' :
            status === 403 ? "You don't have permission to do that." :
            status === 429 ? 'Too many attempts. Please wait a moment.' :
            status >= 500 ? 'Something went wrong. Please try again.' :
            error.response?.data?.message || 'An unexpected error occurred.';

        // Attach friendly message so UI can read it without parsing raw errors
        error.friendlyMessage = friendlyMessage;

        return Promise.reject(error);
    }
);

// Helper — capitalises the first letter of a field name for display
function capitalise(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

export default api;
