import { test, expect } from '@playwright/test';

test.describe('PWA & Feature Verification', () => {
    test.beforeEach(async ({ page }) => {
        // Mock API responses so the Agent Dashboard loads without a backend
        await page.route('**/api/boats', route => route.fulfill({
            status: 200,
            json: [{ id: 1, name: 'E2E Test Boat', agent_id: 1, owner_id: 1 }]
        }));
        await page.route('**/api/buyers', route => route.fulfill({
            status: 200,
            json: []
        }));
        await page.route('**/api/reports/daily*', route => route.fulfill({
            status: 200,
            json: { date: new Date().toISOString().split('T')[0], totalSales: 0, totalExpenses: 0, boatPayments: 0, cashWithAgent: 0, boatProfit: 0 }
        }));
        await page.route('**/api/sales/history*', route => route.fulfill({ status: 200, json: [] }));
        await page.route('**/api/boat-payments*', route => route.fulfill({ status: 200, json: [] }));

        await page.goto('/agent');
        
        await expect(page).toHaveURL(/.*agent/);
        // Wait for header to load
        await expect(page.locator('h1')).toBeVisible();
    });

    test('should show offline indicator and sync notification', async ({ page }) => {
        // Ensure EntryTab is visible before going offline
        await expect(page.locator('input[id="wt"]')).toBeVisible();

        await page.context().setOffline(true);
        // Wait for offline state to propagate to navigator.onLine
        await page.waitForTimeout(1000);
        
        await page.fill('input[id="wt"]', '10.5');
        await page.fill('input[id="rt"]', '100');
        await page.fill('input[placeholder="Fish..."]', 'TestFish');
        
        // Scroll and click
        const addBtn = page.locator('[data-testid="add-row-btn"]');
        await addBtn.scrollIntoViewIfNeeded();
        await addBtn.click({ force: true });
        
        await expect(page.locator('[data-testid="offline-banner"]')).toBeVisible();
        // Wait for the specific toast to appear
        await expect(page.locator('[data-testid="toast"]').filter({ hasText: 'Saved offline' })).toBeVisible({ timeout: 10000 });

        await page.context().setOffline(false);
        await page.waitForTimeout(1000); 
    });

    test('should generate PDF', async ({ page }) => {
        // Switch to reports/slip tab
        await page.click('[data-testid="slip-tab"]', { force: true });
        await page.waitForTimeout(1000); // Wait for AnimatePresence
        
        const pdfBtn = page.locator('[data-testid="download-pdf-btn"]').first();
        await expect(pdfBtn).toBeVisible();
        await pdfBtn.click({ force: true });
    });

    test('should switch languages', async ({ page }) => {
        // Find the toggle button
        const langToggleSelector = '[data-testid="language-toggle"]';
        
        // Initial check (English "Boat" or "BOAT")
        await expect(page.locator('[data-testid="boat-label"]').first()).toHaveText(/boat/i);
        
        // Toggle to Tamil - use evaluate click to bypass any stability issues with AnimatePresence
        await page.evaluate((sel) => {
            (document.querySelectorAll(sel)[0] as HTMLElement)?.click();
        }, langToggleSelector);
        
        await page.waitForTimeout(2000);
        
        // Check for ANY Tamil characters in the boat label
        const boatLabel = page.locator('[data-testid="boat-label"]').last();
        const text = await boatLabel.innerText();
        expect(text).toMatch(/[\u0B80-\u0BFF]/);
        
        // Toggle back to English
        await page.evaluate((sel) => {
            (document.querySelectorAll(sel)[0] as HTMLElement)?.click();
        }, langToggleSelector);
        
        await page.waitForTimeout(2000);
        await expect(page.locator('[data-testid="boat-label"]').last()).toHaveText(/boat/i);
    });
});
