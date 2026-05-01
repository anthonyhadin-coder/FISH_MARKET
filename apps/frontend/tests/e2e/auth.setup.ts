import { test as setup } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const authFile = path.join(__dirname, '../../playwright/.auth/agent.json');

setup('create agent auth state via localStorage injection', async ({ page, request: _request }) => {
    // Auth in FISH_MARKET is stored in localStorage under the 'user' key.
    // We don't need a live backend — just inject the user object and save storageState.
    
    // Navigate to login page first to establish the origin
    await page.goto('/login');
    
    // Inject the authenticated user into localStorage
    await page.evaluate(() => {
        localStorage.setItem('user', JSON.stringify({
            id: '1',
            name: 'Test Agent',
            role: 'agent'
        }));
        document.cookie = 'fm_role=agent; path=/; max-age=86400; SameSite=Lax';
    });
    
    // Ensure auth directory exists
    fs.mkdirSync(path.dirname(authFile), { recursive: true });
    
    // Save the storageState (contains our localStorage entry)
    await page.context().storageState({ path: authFile });
});
