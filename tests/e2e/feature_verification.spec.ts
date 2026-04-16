import { test, expect } from '@playwright/test';
import { setupUniversalMocking } from './test-utils';

test.describe('PWA & Feature Verification', () => {
    test.beforeEach(async ({ page }) => {
        // Set up universal API mocks
        await setupUniversalMocking(page);

        await page.route('**/api/buyers**', route =>
          route.fulfill({ status: 200, contentType: 'application/json',
            body: JSON.stringify([{ id: 1, name: 'Test Buyer' }]) })
        );
        await page.route('**/api/notifications**', route =>
          route.fulfill({ status: 200, contentType: 'application/json',
            body: JSON.stringify([]) })
        );
        await page.route('**/api/boats**', route =>
          route.fulfill({ status: 200, contentType: 'application/json',
            body: JSON.stringify([{ id: 1, name: 'Boat 1', registrationNumber: 'TN-001' }]) })
        );

        await page.goto('/staff');
        await expect(page).toHaveURL(/.*staff/);

        // Wait for the dashboard to be fully mounted
        await expect(page.getByTestId('dashboard-heading')).toBeVisible({ timeout: 15000 });

        // Select the first boat so EntryTab renders (boat-btn comes from AgentView boat selector)
        await page.waitForSelector('[data-testid="boat-btn"]', { timeout: 10000 });
        await page.locator('[data-testid="boat-btn"]').first().click();

        // Confirm entry tab rendered (boat-label is in EntryTab and confirms boat is selected)
        await expect(page.locator('[data-testid="boat-label"]').first()).toBeVisible({ timeout: 10000 });
    });

    test('should show offline indicator and sync notification', async ({ page }) => {
        // Entry form should be visible (boat was selected in beforeEach)
        await expect(page.locator('input[id="wt"]')).toBeVisible({ timeout: 10000 });

        await page.context().setOffline(true);

        // Wait for the offline banner to appear
        await expect(page.locator('[data-testid="offline-banner"]')).toBeVisible({ timeout: 10000 });

        // Fill the entry form
        await page.getByTestId('input-fish').fill('Test Fish');
        await page.getByTestId('input-weight').fill('10.5');
        await page.getByTestId('input-rate').fill('100');

        // Submit
        const addBtn = page.locator('[data-testid="add-row-btn"]');
        await addBtn.scrollIntoViewIfNeeded();
        await addBtn.click({ force: true });

        // Confirm offline and wait for the "Saved offline" toast
        await page.waitForFunction(() => navigator.onLine === false);
        await expect(page.locator('[data-testid="toast"]').filter({ hasText: 'Saved offline' }))
            .toBeVisible({ timeout: 20000 });

        await page.context().setOffline(false);
        await page.waitForTimeout(500);
    });

    test('should generate PDF', async ({ page }) => {
        // Switch to slip tab (boat is already selected from beforeEach)
        await page.click('[data-testid="slip-tab"]', { force: true });

        // Wait for AnimatePresence transition and for the PDF button to appear
        const pdfBtn = page.locator('[data-testid="download-pdf-btn"]').first();
        await expect(pdfBtn).toBeVisible({ timeout: 15000 });
        await pdfBtn.click({ force: true });
    });

    test('should switch languages', async ({ page }) => {
        const langToggleSelector = '[data-testid="language-toggle"]';

        // boat-label exists in EntryTab — shows "Boat" label text in English
        await expect(page.locator('[data-testid="boat-label"]').first()).toHaveText(/boat/i, { timeout: 15000 });

        // Toggle to Tamil
        const toggle = page.locator(langToggleSelector).first();
        await toggle.scrollIntoViewIfNeeded();
        await toggle.click({ force: true });

        // Wait for Tamil characters to appear in the boat label
        await expect(async () => {
            const boatLabel = page.locator('[data-testid="boat-label"]').first();
            await expect(boatLabel).toBeVisible({ timeout: 5000 });
            const text = await boatLabel.innerText();
            if (!/[\u0B80-\u0BFF]/.test(text)) {
                throw new Error(`Tamil text not found in boat label, got: "${text}"`);
            }
        }).toPass({ timeout: 15000 });

        // Toggle back to English and verify
        await toggle.click({ force: true });
        await expect(page.locator('[data-testid="boat-label"]').first()).toHaveText(/boat/i, { timeout: 15000 });
    });
});
