import { test, expect } from '@playwright/test';
import { setupUniversalMocking, fulfillWithCors } from './test-utils';

test.describe('Authentication Stabilization Verification', () => {
    // Override global storage state to start unauthenticated
    test.use({ storageState: { cookies: [], origins: [] } });

    test.beforeEach(async ({ page }) => {
        await setupUniversalMocking(page);
    });

    /**
     * VERIFIES FIX: Infinite Redirect / Refresh Loop
     * Logic: If /api/auth/me fails with 401 AND /api/auth/refresh fails with 401,
     * the app should redirect to /login ONCE and STOP.
     */
    test('should redirect to login exactly once when session and refresh expire', async ({ page }) => {
        let refreshCount = 0;
        let meCount = 0;

        // Seed optimistic user state so AuthContext thinks we WERE logged in
        await page.addInitScript(() => {
            localStorage.setItem('user', JSON.stringify({ id: '1', name: 'Stale User', role: 'agent' }));
        });

        // Intercept /api/auth/me to return 401
        await page.route('**/api/auth/me', async route => {
            meCount++;
            return fulfillWithCors(route, { status: 401, json: { message: 'Unauthorized' } });
        });

        // Intercept /api/auth/refresh to return 401
        await page.route('**/api/auth/refresh', async route => {
            refreshCount++;
            return fulfillWithCors(route, { status: 401, json: { message: 'Refresh token expired' } });
        });

        // Track redirects
        const redirectPromise = page.waitForURL(url => url.pathname === '/login');
        
        console.log('Navigating to protected route /agent...');
        await page.goto('/agent');

        await redirectPromise;
        
        // Wait a bit to ensure activity settles
        await page.waitForTimeout(2000);

        console.log(`FINAL COUNTS: meCount=${meCount}, refreshCount=${refreshCount}`);

        // Expectations:
        // meCount: React Strict Mode + Hydration + Routing can cause multiple calls.
        expect(meCount).toBeLessThan(10);
        
        // REFRESH DEDUPLICATION VERIFIED:
        // Even with multiple concurrent /me calls, they should all wait for the SINGLE refresh call.
        expect(refreshCount).toBe(1);

        // URL should be /login with reason
        expect(page.url()).toContain('/login');
        expect(page.url()).toContain('reason=session-expired');
    });

    /**
     * VERIFIES FIX: Google Auth Interceptor Loop
     * Logic: If Google Auth fails with 401, the interceptor should NOT try to refresh.
     */
    test('should NOT attempt token refresh if /auth/google fails', async ({ page }) => {
        let refreshCount = 0;

        await page.route('**/api/auth/refresh', async route => {
            refreshCount++;
            return fulfillWithCors(route, { status: 401, json: { message: 'Expired' } });
        });

        await page.route('**/api/auth/google', async route => {
            return fulfillWithCors(route, { status: 401, json: { message: 'Invalid Google Token' } });
        });

        await page.goto('/login');

        // We can't easily click the native Google button in a mock environment safely without complex frame handling,
        // but we can trigger the API call directly via browser console to test the interceptor logic.
        await page.evaluate(async () => {
            // @ts-expect-error - axios is attached to window in mock environment
            try { await window.axios.post('/api/auth/google', { credential: 'fake' }); } catch (_e) {}
        });

        await page.waitForTimeout(1000);

        // refreshCount should be 0 because we added /auth/google to the excluded list
        expect(refreshCount).toBe(0);
    });
});
