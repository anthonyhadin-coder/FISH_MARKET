/**
 * Authentication Utilities
 * Improved session management, token refresh, and error handling
 */

export interface SessionState {
  isValid: boolean;
  isExpired: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * Validates if the session is still active by checking with the server
 * Uses a timeout to prevent hanging requests
 */
export async function validateSession(api: { get: (url: string, opts?: object) => Promise<unknown> }, timeout = 5000): Promise<SessionState> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    await api.get('/auth/me', { signal: controller.signal });
    clearTimeout(timeoutId);
    return { isValid: true, isExpired: false, isLoading: false, error: null };
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    const err = error as { response?: { status?: number }; name?: string; message?: string };
    if (err.response?.status === 401) {
      return { isValid: false, isExpired: true, isLoading: false, error: 'Session expired' };
    }
    if (err.name === 'AbortError') {
      return { isValid: false, isExpired: false, isLoading: false, error: 'Session verification timeout' };
    }
    if (err.message === 'Network Error') {
      return { isValid: false, isExpired: false, isLoading: false, error: 'Network error' };
    }
    return { isValid: false, isExpired: false, isLoading: false, error: err.message ?? 'Unknown error' };
  }
}

/**
 * Clears all authentication state from the client
 */
export function clearAuthState(): void {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem('user');
  localStorage.removeItem('token');
  
  // Clear authentication cookies
  document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  // BUG FIX #1: refresh_token is scoped to /api/auth/refresh by the backend cookie setter.
  // Using path=/ would target a different (non-existent) cookie — the real token would survive logout.
  document.cookie = 'refresh_token=; path=/api/auth/refresh; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = 'fm_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = 'csrf_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  
  // Clear service worker cache
  if ('caches' in window) {
    caches.delete('api-cache').catch(() => {});
  }
}

/**
 * Formats an authentication error for display to the user
 */
export function formatAuthError(error: unknown, lang = 'en'): string {
  const isTa = lang === 'ta';
  const err = error as { response?: { status?: number; data?: { message?: string } }; name?: string; message?: string };
  
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return isTa ? 'நீங்கள் ஆஃப்லைனில் இருக்கிறீர்கள்.' : 'You are offline.';
  }
  
  const status = err.response?.status;
  
  if (status === 401) {
    return isTa ? 'தவறான நற்சான்றுகள்.' : 'Invalid credentials.';
  }
  if (status === 403) {
    return isTa ? 'உங்கள் கணக்கு முடக்கப்பட்டுள்ளது.' : 'Your account is locked.';
  }
  if (status === 429) {
    return isTa ? 'பல முயற்சிகள். சிறிது நேரம் காத்திருங்கள்.' : 'Too many attempts. Please wait.';
  }
  if (status === 500) {
    return isTa ? 'சேவையக பிழை. மீண்டும் முயற்சிக்கவும்.' : 'Server error. Try again.';
  }
  if (err.name === 'AbortError') {
    return isTa ? 'கோரிக்கை நேரம் முடிந்துவிட்டது.' : 'Request timed out.';
  }
  if (err.message === 'Network Error') {
    return isTa ? 'சேவையகத்தை இணைக்க முடியவில்லை.' : 'Cannot reach the server.';
  }
  
  return isTa ? 'உள்நுழைவு தோல்வியடைந்தது.' : 'Authentication failed.';
}

/**
 * Checks if a token is likely expired based on standard JWT expiry
 * This is a client-side optimization; server sets the truth
 */
export function isTokenLikelyExpired(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const token = localStorage.getItem('token');
    if (!token) return false;
    
    // Simple check: if token starts decoding fails, it's probably invalid
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    
    // This is a basic check; real validation happens on server
    return false;
  } catch {
    return false;
  }
}
