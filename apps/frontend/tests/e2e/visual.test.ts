import { test, expect } from '@playwright/test';
import { setupUniversalMocking } from './test-utils';
import { existsSync } from 'fs';
import path from 'path';

test.beforeAll(() => {
  if (process.env.CI) return; // CI will generate snapshots if missing

  const snapshotDir = path.join(__dirname, 'visual.test.ts-snapshots');
  const files = existsSync(snapshotDir) ? require('fs').readdirSync(snapshotDir) : [];
  
  const hasHome = files.some((f: string) => f.startsWith('home-page'));
  const hasVoice = files.some((f: string) => f.startsWith('voice-dialog'));

  if (!hasHome || !hasVoice) {
    console.warn('⚠️  Visual snapshots missing — run with --update-snapshots first');
    test.skip();
  }
});

test.describe('Visual Regression (Percy/Chromatic)', () => {
  test('Home page visual snapshot', async ({ page }) => {
    await setupUniversalMocking(page);
    // Explicitly force logged-out state for landing page to ensure "Login/Register" buttons show
    await page.route('**/api/auth/me', route => 
      route.fulfill({ 
        status: 401, 
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Unauthorized' }) 
      })
    );

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500); // let fonts + animations settle

    await expect(page).toHaveScreenshot('home-page.png', {
      maxDiffPixelRatio: 0.25,
      threshold: 0.3,
      animations: 'disabled',
      mask: [
        page.locator('img[alt="Ocean Fish Market"]'), // mask external Unsplash image
        page.locator('.lucide'),                      // mask all Lucide icons
        page.locator('[data-dynamic]'),               // any time-based content
      ]
    });
  });

  test('Voice Input Dialog visual snapshot', async ({ page }) => {
    // Centralized API mocks and __PLAYWRIGHT_TEST__ flag
    await setupUniversalMocking(page);

    // Mock auth and staff data needed for /staff page
    await page.route('**/api/auth/me', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 1, name: 'Test Agent',
            role: 'agent', phone: '9876543210'
          }
        })
      })
    );

    await page.route('**/api/boats**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 1, name: 'Boat 1' }])
      })
    );

    await page.route('**/api/buyers**', route =>
      route.fulfill({ status: 200, body: JSON.stringify([]) })
    );

    await page.route('**/api/notifications**', route =>
      route.fulfill({ status: 200, body: JSON.stringify([]) })
    );
    
    // Navigate to /agent instead of /staff
    await page.goto('/agent');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500); // let animations settle

    // Force stable dialog width before screenshot
    await page.addStyleTag({
      content: `.voice-dialog-container { width: 360px !important; max-width: 360px !important; }`
    });

    const helpBtn = page.locator('[data-testid="voice-help-btn"]').first();
    
    // Debug helper: if button not found, take screenshot and log info
    if (await helpBtn.count() === 0) {
      console.log('Voice help btn not found. Page URL:', page.url());
      await page.screenshot({ path: 'test-results/voice-debug-not-found.png' });
      throw new Error('voice-help-btn not found — check the page and testid');
    }

    // Use force:true to ignore mobile header overlap/interception
    await helpBtn.click({ force: true });
    await page.waitForSelector('.voice-dialog-container', { 
      state: 'visible',
      timeout: 10000
    });
    await page.waitForTimeout(500);

    await expect(page.locator('.voice-dialog-container')).toHaveScreenshot('voice-dialog.png', {
      maxDiffPixelRatio: 0.15,
      threshold: 0.3,
      animations: 'disabled',
      mask: [page.locator('canvas')],
      maxDiffPixels: 200,
    });
  });
});
