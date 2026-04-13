import { test, expect } from '@playwright/test';
import { fulfillWithCors, corsHeaders } from './test-utils';

test.describe('Analytics Visual Regression', () => {
    
    test.beforeEach(async ({ page }) => {
        // Mock API responses for stability
        // Mock ALL API calls to prevent any unhandled network timeouts
        await page.route('**/api/**', async route => {
            const url = route.request().url();
            const method = route.request().method();
            console.log(`INTERCEPTED API CALL: [${method}] ${url}`);
            
            if (method === 'OPTIONS') {
                return route.fulfill({ status: 204, headers: corsHeaders });
            }

            if (url.includes('/auth/me')) {
                return fulfillWithCors(route, { json: { user: { id: '1', name: 'Test Agent', role: 'agent' } } });
            }
            if (url.includes('/reports')) {
                if (url.includes('trends')) {
                    const deterministicTrends = [
                        { date: '2026-03-10', sales: 5200, expenses: 1100 },
                        { date: '2026-03-11', sales: 4800, expenses: 900 },
                        { date: '2026-03-12', sales: 6100, expenses: 1200 },
                        { date: '2026-03-13', sales: 5500, expenses: 1000 },
                        { date: '2026-03-14', sales: 5900, expenses: 1300 },
                        { date: '2026-03-15', sales: 6500, expenses: 1400 },
                        { date: '2026-03-16', sales: 5800, expenses: 1100 },
                        { date: '2026-03-17', sales: 5400, expenses: 950 },
                        { date: '2026-03-18', sales: 6200, expenses: 1250 },
                        { date: '2026-03-19', sales: 7000, expenses: 1500 },
                        { date: '2026-03-20', sales: 6800, expenses: 1400 },
                        { date: '2026-03-21', sales: 7200, expenses: 1600 },
                        { date: '2026-03-22', sales: 6500, expenses: 1300 },
                        { date: '2026-03-23', sales: 7500, expenses: 1700 }
                    ];
                    return fulfillWithCors(route, { json: deterministicTrends });
                }
                return fulfillWithCors(route, {
                    json: {
                        totalSales: 15000,
                        totalExpenses: 2500,
                        expenseBreakdown: [
                            { type: 'diesel', amount: 1200 },
                            { type: 'ice', amount: 800 },
                            { type: 'van', amount: 500 }
                        ]
                    }
                });
            }
            if (url.includes('/boats')) {
                return fulfillWithCors(route, { json: [ { id: 1, name: 'Sea King' }, { id: 2, name: 'Ocean Pearl' } ] });
            }
            if (url.includes('/buyers')) {
                return fulfillWithCors(route, { json: [ { id: 1, name: 'Ravi' } ] });
            }
            if (url.includes('/sales') || url.includes('/payments') || url.includes('/history')) {
                return fulfillWithCors(route, { json: [] });
            }
            if (url.includes('/notifications')) {
                return fulfillWithCors(route, { json: [] });
            }
            
            return fulfillWithCors(route, { json: {} });
        });

        // Disable Recharts animations by setting the window flag
        await page.addInitScript(() => {
            (window as any).__PLAYWRIGHT_TEST__ = true;
        });

        // Log browser console to test output
        page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
        page.on('pageerror', error => console.error('BROWSER ERROR:', error.message));

        // Navigation (Auth is handled by storageState from setup project)
        await page.goto('/staff');
        
        // Dismiss Next.js error overlay if present
        const overlay = page.locator('nextjs-portal');
        if (await overlay.isVisible()) {
            await page.keyboard.press('Escape');
            await overlay.waitFor({ state: 'hidden' });
        }

        // Wait for hydration by ensuring default tab content is visible and interactive
        await expect(page.getByTestId('input-fish')).toBeVisible();
        await page.waitForTimeout(500); // Wait for React concurrent mode flush
        
        // Navigate to Reports Tab
        await page.locator('[data-testid="reports-tab"]').click({ force: true });
        
        // Give Recharts time to measure and inject SVG
        await page.waitForTimeout(3000);
        await page.waitForLoadState('networkidle');
    });

    test('Desktop: Reports Tab Visual Consistency', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        // Extra stabilization wait for animations
        await page.waitForTimeout(1500);
        const reportsTab = page.getByTestId('reports-tab-content'); 
        await expect(reportsTab).toHaveScreenshot({ 
            timeout: 10000,
            mask: [page.locator('.recharts-surface')],
            maxDiffPixelRatio: 0.05,
            threshold: 0.2,
            animations: 'disabled'
        });
    });

    test('Mobile: Reports Tab Responsiveness', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        // Extra stabilization wait for animations
        await page.waitForTimeout(1500);
        const reportsTab = page.getByTestId('reports-tab-content');
        await expect(reportsTab).toHaveScreenshot({ 
            timeout: 10000,
            mask: [page.locator('.recharts-surface')],
            maxDiffPixelRatio: 0.05,
            threshold: 0.2,
            animations: 'disabled'
        });
    });

    test('Tamil: Reports Tab Visuals', async ({ page }) => {
        test.slow(); // Give more time for Tamil rendering and snapshots
        
        // Switch to Tamil
        await page.click('[data-testid="language-toggle"]');
        
        // Wait for Tamil labels (Heading: விற்பனை போக்கு)
        await page.waitForSelector('text=விற்பனை போக்கு', { timeout: 10000 });
        await page.waitForTimeout(2000);
        
        const reportsTab = page.getByTestId('reports-tab-content');
        await expect(reportsTab).toHaveScreenshot({ 
            timeout: 15000,
            mask: [page.locator('.recharts-surface')],
            maxDiffPixelRatio: 0.1,
            threshold: 0.2,
            animations: 'disabled'
        });
    });
});
