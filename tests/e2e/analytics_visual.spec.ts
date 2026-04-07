import { test, expect } from '@playwright/test';

test.describe('Analytics Visual Regression', () => {
    
    test.beforeEach(async ({ page }) => {
        // Mock API responses for stability
        // Mock ALL API calls to prevent any unhandled network timeouts
        await page.route('**/api/**', async route => {
            const url = route.request().url();
            console.log('INTERCEPTED API CALL:', url);
            
            if (url.includes('/reports/trends')) {
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
                console.log('-> Returning trends data');
                return route.fulfill({ json: deterministicTrends });
            }
            if (url.includes('/reports/daily')) {
                console.log('-> Returning daily data');
                return route.fulfill({
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
                console.log('-> Returning boats data');
                return route.fulfill({ json: [ { id: 1, name: 'Sea King' }, { id: 2, name: 'Ocean Pearl' } ] });
            }
            if (url.includes('/buyers')) {
                console.log('-> Returning buyers data');
                return route.fulfill({ json: [ { id: 1, name: 'Ravi' } ] });
            }
            if (url.includes('/sales/history') || url.includes('/boat-payments')) {
                console.log('-> Returning empty array');
                return route.fulfill({ json: [] });
            }
            
            console.log('-> Returning empty object fallback');
            return route.fulfill({ json: {} });
        });

        // Disable Recharts animations by setting the window flag
        await page.addInitScript(() => {
            (window as any).__PLAYWRIGHT_TEST__ = true;
        });

        // Log browser console to test output
        page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
        page.on('pageerror', error => console.error('BROWSER ERROR:', error.message));

        // Navigation (Auth is handled by storageState from setup project)
        await page.goto('/agent');
        
        // Dismiss Next.js error overlay if present
        const overlay = page.locator('nextjs-portal');
        if (await overlay.isVisible()) {
            await page.keyboard.press('Escape');
            await overlay.waitFor({ state: 'hidden' });
        }

        // Navigate to Reports Tab
        await page.locator('[data-testid="reports-tab"]').click({ force: true });
        
        // Wait for charts to fully render
        try {
            await page.waitForSelector('[data-testid="analytics-chart"]', { timeout: 15000 });
        } catch (e) {
            console.error("Timeout! Dumping HTML body to debug.html...");
            const html = await page.content();
            require('fs').writeFileSync('debug.html', html);
            throw e;
        }
        await page.waitForLoadState('networkidle');
    });

    test('Desktop: Reports Tab Visual Consistency', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        
        // Wait for Recharts to finish rendering
        await page.waitForFunction(() => {
            const chart = document.querySelector('.recharts-wrapper');
            return chart !== null;
        }, { timeout: 15000 });

        // Small delay for animations to settle
        await page.waitForTimeout(2000);
        
        const reportsTab = page.locator('div.space-y-6').nth(1); 
        await expect(reportsTab).toHaveScreenshot('reports-desktop.png');
    });

    test('Mobile: Reports Tab Responsiveness', async ({ page }) => {
        // Pixel 5 viewport is set by config for Mobile project, 
        // but we can override or use setViewportSize for manual control in the test
        await page.setViewportSize({ width: 390, height: 844 });
        
        await page.waitForFunction(() => {
            const chart = document.querySelector('.recharts-wrapper');
            return chart !== null;
        }, { timeout: 15000 });

        await page.waitForTimeout(2000);
        
        const reportsTab = page.locator('div.space-y-6').nth(1);
        await expect(reportsTab).toHaveScreenshot('reports-mobile.png');
    });

    test('Tamil: Reports Tab Visuals', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        
        // Switch to Tamil
        await page.click('[data-testid="language-toggle"]');
        
        // Wait for Tamil labels (Heading: விற்பனை போக்கு)
        await page.waitForSelector('text=விற்பனை போக்கு', { timeout: 10000 });
        await page.waitForTimeout(2000);
        
        const reportsTab = page.locator('div.space-y-6').nth(1);
        await expect(reportsTab).toHaveScreenshot('reports-tamil.png');
    });
});
