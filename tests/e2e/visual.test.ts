import { test, expect, type Page } from '@playwright/test';
import { fulfillWithCors, corsHeaders } from './test-utils';

test.describe('Visual Regression (Percy/Chromatic)', () => {
  test('Home page visual snapshot', async ({ page }: { page: Page }) => {
    await page.goto('/');
    
    // Using Playwright's native screenshot as a baseline if Percy is not set up
    await expect(page).toHaveScreenshot('home-page.png', {
      maxDiffPixelRatio: 0.1,
    });
    
    // Integration Hook Examples:
    // await percySnapshot(page, 'Home Page - Deep Ocean');
  });

  test('Voice Input Dialog visual snapshot', async ({ page }: { page: Page }) => {
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

        if (url.includes('/api/auth/me')) {
            return fulfillWithCors(route, { json: { user: { id: '1', name: 'Test Agent', role: 'agent' } } });
        }
        if (url.includes('/api/boats')) {
            return fulfillWithCors(route, { json: [{ id: 1, name: 'E2E Test Boat' }] });
        }
        if (url.includes('/api/buyers')) {
            return fulfillWithCors(route, { json: [] });
        }
        if (url.includes('/api/reports/daily')) {
            return fulfillWithCors(route, { json: {} });
        }
        if (url.includes('/api/sales/history') || url.includes('/api/boat-payments')) {
            return fulfillWithCors(route, { json: [] });
        }
        if (url.includes('/api/notifications')) {
            return fulfillWithCors(route, { json: [] });
        }
        
        return fulfillWithCors(route, { json: {} });
    });
    
    await page.goto('/staff');
    
    // Ensure the help button is clickable to open the guide modal
    await page.click('button[title="Help"]', { force: true });
    
    await expect(page.locator('.voice-dialog-container')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.voice-dialog-container')).toHaveScreenshot('voice-dialog.png');
  });
});
