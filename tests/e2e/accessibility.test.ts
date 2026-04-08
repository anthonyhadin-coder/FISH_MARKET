import { test, expect, type Page } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Accessibility (WCAG 2.1 AA)', () => {
  test('Home Page should be accessible', async ({ page }: { page: Page }) => {
    await page.goto('/');
    await injectAxe(page);
    await checkA11y(page, undefined, {
      detailedReport: true,
      detailedReportOptions: { html: true },
    });
  });

  test('Voice Entry Tab should have proper contrast and tab order', async ({ page }: { page: Page }) => {
    await page.route('**/api/auth/me', route => route.fulfill({ status: 200, json: { user: { id: '1', name: 'Test Agent', role: 'agent' } } }));
    await page.goto('/staff'); // Adjust based on routing
    await injectAxe(page);
    
    // Check contrast for Deep Ocean theme
    await checkA11y(page, {
      runOnly: {
        type: 'tag',
        values: ['color-contrast'],
      },
    });

    // Verify keyboard navigation
    // Verify keyboard navigation - voice button should be focusable via Tab after language toggle
    const langToggle = page.locator('[data-testid="language-toggle"]');
    const voiceButton = page.locator('button[aria-label="Start voice entry"]');
    await langToggle.focus();
    await page.keyboard.press('Tab');
    await expect(voiceButton).toBeFocused();
  });
});
