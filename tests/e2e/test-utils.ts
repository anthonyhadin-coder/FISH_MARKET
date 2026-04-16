import { Route, Page } from '@playwright/test';

export const corsHeaders = {
    'Access-Control-Allow-Origin': 'http://localhost:3000',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept'
};

export async function fulfillWithCors(route: Route, options: { status?: number, json?: any, headers?: Record<string, string> }) {
    const request = route.request();
    const origin = request.headers().origin || 'http://localhost:3000';
    
    try {
        await route.fulfill({
            status: options.status || 200,
            headers: {
                'Access-Control-Allow-Origin': origin,
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, X-Requested-With',
                'Content-Type': 'application/json',
                ...(options.headers || {})
            },
            json: options.json
        });
    } catch (err: any) {
        console.error(`FAILED TO FULFILL: ${request.url()}`, err.message, err.code);
    }
}

/**
 * Sets up a broad, universal API mocker that intercepts all /api calls.
 */
export async function setupUniversalMocking(page: Page) {
    // Set flag for api.ts to use relative path and avoid production backend
    await page.addInitScript(() => {
        (window as any).__PLAYWRIGHT_TEST__ = true;
    });

    // Universal Interceptor
    await page.route('**/api/**', async route => {
        const url = route.request().url();
        const method = route.request().method();
        const origin = route.request().headers().origin || 'http://localhost:3000';
        
        console.log(`[MOCK] [${method}] ${url}`);
        
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

        // --- Core Endpoint Handlers ---
        
        // Session
        if (url.includes('/auth/me')) {
            return fulfillWithCors(route, { json: { user: { id: '1', name: 'Test Agent', role: 'agent' } } });
        }

        // Entities
        if (url.includes('/boats')) {
            return fulfillWithCors(route, { json: [ { id: 1, name: 'Sea King' }, { id: 2, name: 'Ocean Pearl' } ] });
        }
        if (url.includes('/buyers')) {
            return fulfillWithCors(route, { json: [ { id: 1, name: 'Ravi' } ] });
        }

        // Analytics / Reports
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
                return fulfillWithCors(route, { json: deterministicTrends });
            }
            // Default Daily Report
            return fulfillWithCors(route, { 
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

        // Generic catch-all for other api calls
        return fulfillWithCors(route, { json: [] });
    });
}
