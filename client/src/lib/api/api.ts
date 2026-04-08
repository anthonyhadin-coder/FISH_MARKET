import axios from 'axios';
import createAuthRefreshInterceptor from 'axios-auth-refresh';

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
    withCredentials: true, // Send HttpOnly cookies automatically
});

// Function that will be called to refresh authorization
const refreshAuthLogic = (failedRequest: any) =>
    axios
        .post((process.env.NEXT_PUBLIC_API_URL || '/api') + '/auth/refresh', {}, { withCredentials: true })
        .then((tokenRefreshResponse) => {
            return Promise.resolve();
        })
        .catch((err) => {
            // Signal AuthContext to kick the user out since refresh failed
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('auth:unauthorized'));
            }
            return Promise.reject(err);
        });

// Instantiate the interceptor
createAuthRefreshInterceptor(api, refreshAuthLogic, {
    statusCodes: [401], // Refresh on 401 Unauthorized
    // @ts-ignore - TS types are missing this property but the library supports it
    pauseInstanceWhileRefreshing: true,
});

export default api;
