import { test, expect, Page } from '@playwright/test';
import { fulfillWithCors, corsHeaders } from './test-utils';

test.describe('PWA & Feature Verification', () => {
    test.beforeEach(async ({ page }) => {
        // Disable animations and enable relative API paths
        await page.addInitScript(() => {
            (window as any).__PLAYWRIGHT_TEST__ = true;
        });

        // Consolidated API mocks
        await page.route('**/api/**', async (route) => {
            const url = route.request().url();
            const method = route.request().method();
            
            if (method === 'OPTIONS') {
                return route.fulfill({ status: 204, headers: corsHeaders });
            }

            if (url.includes('/api/boats')) {
                return fulfillWithCors(route, { json: [{ id: 1, name: 'E2E Test Boat', agent_id: 1, owner_id: 1 }] });
            }
            if (url.includes('/api/buyers')) {
                return fulfillWithCors(route, { json: [] });
            }
            if (url.includes('/api/reports/daily')) {
                return fulfillWithCors(route, {
                    json: { date: new Date().toISOString().split('T')[0], totalSales: 0, totalExpenses: 0, boatPayments: 0, cashWithAgent: 0, boatProfit: 0 }
                });
            }
            if (url.includes('/api/sales/history') || url.includes('/api/boat-payments')) {
                return fulfillWithCors(route, { json: [] });
            }
            if (url.includes('/api/auth/me')) {
                return fulfillWithCors(route, { json: { user: { id: '1', name: 'Test Agent', role: 'agent' } } });
            }
            if (url.includes('/api/notifications')) {
                return fulfillWithCors(route, { json: [] });
            }
            
            // Fallback for other API calls to prevent unhandled network errors
            return fulfillWithCors(route, { json: {} });
        });

        // Disable animations and enable relative API paths
        await page.addInitScript(() => {
            (window as any).__PLAYWRIGHT_TEST__ = true;
        });

        await page.goto('/staff');
        
        await expect(page).toHaveURL(/.*staff/);
        // Wait for header to load - use exact name to avoid strict mode violation with sr-only h1
        await expect(page.getByRole('heading', { name: 'Fish Market Ledger', exact: true })).toBeVisible();
    });

    test('should show offline indicator and sync notification', async ({ page }) => {
        // Ensure EntryTab is visible before going offline
        await expect(page.locator('input[id="wt"]')).toBeVisible();

        await page.context().setOffline(true);
        // Wait for offline state and for the banner to appear
        await page.waitForTimeout(2000);
        await expect(page.locator('[data-testid="offline-banner"]')).toBeVisible({ timeout: 10000 });
        
        // Use reliable data-testid selectors for the entry form
        await page.getByTestId('input-fish').fill('Test Fish');
        await page.getByTestId('input-weight').fill('10.5');
        await page.getByTestId('input-rate').fill('100');
        
        // Scroll and click
        const addBtn = page.locator('[data-testid="add-row-btn"]');
        await addBtn.scrollIntoViewIfNeeded();
        await addBtn.click({ force: true });
        
        // Wait for the specific toast to appear
        // FIX 4: Confirm browser is offline before polling for the toast
        await page.waitForFunction(() => navigator.onLine === false);
        await expect(page.locator('[data-testid="toast"]').filter({ hasText: 'Saved offline' }))
            .toBeVisible({ timeout: 20000 });

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
        // - [x] Run final E2E check (Accessibility + Feature)
        // - [x] Fix language switch regression (Mobile Pixel 5 flakiness)
        
        // Find the toggle button
        const langToggleSelector = '[data-testid="language-toggle"]';
        
        // Initial check (English "Boat" or "BOAT")
        await expect(page.locator('[data-testid="boat-label"]').first()).toHaveText(/boat/i, { timeout: 15000 });
        
        // Toggle to Tamil
        const toggle = page.locator(langToggleSelector).first();
        await toggle.scrollIntoViewIfNeeded();
        await toggle.click({ force: true });
        
        // Wait for ANY Tamil characters in the boat label - retry if needed
        await expect(async () => {
          const boatLabel = page.locator('[data-testid="boat-label"]').last();
          await expect(boatLabel).toBeVisible({ timeout: 5000 });
          const text = await boatLabel.innerText();
          if (!/[\u0B80-\u0BFF]/.test(text)) {
            throw new Error('Tamil text not found');
          }
        }).toPass({ timeout: 15000 });
        
        // Toggle back to English
        await toggle.click({ force: true });
        
        await expect(page.locator('[data-testid="boat-label"]').last()).toHaveText(/boat/i, { timeout: 15000 });
    });
});
