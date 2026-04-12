import { Route } from '@playwright/test';

export const corsHeaders = {
    'Access-Control-Allow-Origin': 'http://localhost:3000',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept'
};

export async function fulfillWithCors(route: Route, options: { status?: number, json?: any, headers?: Record<string, string> }) {
    const request = route.request();
    const origin = request.headers().origin || 'http://localhost:3000';
    console.log(`FULFILLING: [${request.method()}] ${request.url()} | Origin: ${origin}`);
    
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
