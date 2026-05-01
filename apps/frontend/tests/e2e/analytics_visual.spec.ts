import { test, expect } from '@playwright/test';
import { setupUniversalMocking } from './test-utils';

test.describe('Analytics Visual Regression', () => {
    
    test.beforeEach(async ({ page }) => {
        // Log browser console to test output
        page.on('console', msg => {
            const text = msg.text();
            console.log(`BROWSER CONSOLE: [${msg.type()}] ${text}`);
        });
        page.on('pageerror', error => console.error('BROWSER ERROR:', error.message));

        // Centralized API mocks and __PLAYWRIGHT_TEST__ flag
        await setupUniversalMocking(page);

        // Navigation
        console.log("Navigating to /agent...");
        await page.goto('/agent');
        
        // Wait for hydration by ensuring the sr-only heading is attached
        await page.waitForSelector('main[role="main"] h1', { state: 'attached', timeout: 30000 });
        await page.waitForTimeout(5000); // Allow React state AND animations to settle
        
        // Navigate to Reports Tab
        await page.locator('[data-testid="reports-tab"]').click({ force: true });
        
        // Wait for Reports content to be visible
        await expect(page.getByTestId('reports-tab-content')).toBeVisible({ timeout: 15000 });
        
        // Give Recharts time to measure and inject SVG
        await page.waitForTimeout(3000);
        await page.waitForLoadState('networkidle');
    });

    test('Desktop: Reports Tab Visual Consistency', async ({ page }) => {
        // Viewport is default Desktop Chrome
        const reportsTab = page.getByTestId('reports-tab-content'); 
        await expect(reportsTab).toHaveScreenshot('reports-desktop.png', { 
            timeout: 15000,
            mask: [page.locator('.recharts-surface')],
            maxDiffPixelRatio: 0.1,
            threshold: 0.2,
            animations: 'disabled'
        });
    });

    test('Mobile: Reports Tab Responsiveness', async ({ page }) => {
        // Redundantly ensure viewport if needed, though project config handles it
        await page.setViewportSize({ width: 390, height: 844 });
        
        // Extra stabilization for mobile layout shift
        await page.waitForTimeout(3000);
        
        const reportsTab = page.getByTestId('reports-tab-content');
        await expect(reportsTab).toHaveScreenshot('reports-mobile.png', { 
            timeout: 15000,
            mask: [page.locator('.recharts-surface')],
            maxDiffPixelRatio: 0.15, // Higher tolerance for mobile ResponsiveContainer
            threshold: 0.2,
            animations: 'disabled'
        });
    });

    test('Tamil: Reports Tab Visuals', async ({ page }) => {
        test.slow();
        
        // Switch to Tamil
        await page.click('[data-testid="language-toggle"]');
        
        // Wait for Tamil labels (Heading: விற்பனை போக்கு)
        await page.waitForSelector('text=விற்பனை போக்கு', { timeout: 10000 });
        await page.waitForTimeout(5000);
        
        const reportsTab = page.getByTestId('reports-tab-content');
        await expect(reportsTab).toHaveScreenshot('reports-tamil.png', { 
            timeout: 20000,
            mask: [page.locator('.recharts-surface')],
            maxDiffPixelRatio: 0.1,
            threshold: 0.2,
            animations: 'disabled'
        });
    });
});
