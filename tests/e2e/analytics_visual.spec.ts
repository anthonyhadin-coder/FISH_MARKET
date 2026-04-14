import { test, expect } from '@playwright/test';
import { fulfillWithCors, corsHeaders } from './test-utils';

test.describe('Analytics Visual Regression', () => {
    
    test.beforeEach(async ({ page }) => {
        // Mock API responses for stability
        // Use a broader interceptor to ensure all /api/ calls are caught
        await page.route(url => url.toString().includes('/api/'), async route => {
            const request = route.request();
            const url = request.url();
            const method = request.method();
            // Get origin for CORS
            const origin = request.headers().origin || 'http://localhost:3000';
            
            console.log(`INTERCEPTED API CALL: [${method}] ${url} | Origin: ${origin}`);
            
            if (method === 'OPTIONS') {
                return route.fulfill({ 
                    status: 204, 
                    headers: {
                        'Access-Control-Allow-Origin': origin,
                        'Access-Control-Allow-Credentials': 'true',
                        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
                        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, X-Requested-With'
                    }
                });
            }

            // Helper to fulfill with CORS
            const fulfillWithCorsLocal = (data: any) => route.fulfill({
                status: 200,
                headers: {
                    'Access-Control-Allow-Origin': origin,
                    'Access-Control-Allow-Credentials': 'true',
                    'Content-Type': 'application/json'
                },
                json: data
            });

            // Standard Auth mock
            if (url.includes('/auth/me')) {
                return fulfillWithCorsLocal({ user: { id: '1', name: 'Test Agent', role: 'agent' } });
            }

            // Reports / Trends
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
                    return fulfillWithCorsLocal(deterministicTrends);
                }
                return fulfillWithCorsLocal({
                    totalSales: 15000,
                    totalExpenses: 2500,
                    expenseBreakdown: [
                        { type: 'diesel', amount: 1200 },
                        { type: 'ice', amount: 800 },
                        { type: 'van', amount: 500 }
                    ]
                });
            }

            // Core Dashboard entities
            if (url.includes('/boats')) {
                return fulfillWithCorsLocal([ { id: 1, name: 'Sea King' }, { id: 2, name: 'Ocean Pearl' } ]);
            }
            if (url.includes('/buyers')) {
                return fulfillWithCorsLocal([ { id: 1, name: 'Ravi' } ]);
            }
            if (url.includes('/notifications')) {
                return fulfillWithCorsLocal({ notifications: [] }); 
            }
            
            // Generic catch-all for other sales/payments/history/sync
            return fulfillWithCorsLocal([]);
        });

        // Disable Recharts animations
        await page.addInitScript(() => {
            (window as any).__PLAYWRIGHT_TEST__ = true;
        });

        // Navigation
        await page.goto('/staff');
        
        // Wait for hydration by ensuring the sr-only heading is attached
        await page.waitForSelector('main[role="main"] h1', { state: 'attached', timeout: 30000 });
        await page.waitForTimeout(1000); // Allow React state to settle
        
        // Navigate to Reports Tab
        await page.locator('[data-testid="reports-tab"]').click({ force: true });
        
        // Wait for Reports content to be visible
        await expect(page.getByTestId('reports-tab-content')).toBeVisible({ timeout: 15000 });
        
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
