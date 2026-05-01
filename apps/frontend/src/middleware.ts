import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Fish Market Server-Side Proxy
 * Enforces route protection and role-based redirection.
 */

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    
    // Get role from cookies (synced by AuthContext)
    const roleCookie = request.cookies.get('fm_role')?.value;
    const role = roleCookie?.toLowerCase(); // 'agent' | 'owner' | 'admin'
    
    // 1. Redirection for Auth Pages (/login, /register)
    // If the user already has a valid role, keep them away from login/register
    if (pathname === '/login' || pathname === '/register') {
        if (role) {
            // Redirecting logged-in user
            const target = (role === 'admin' || role === 'owner') ? '/owner' : '/agent';
            return NextResponse.redirect(new URL(target, request.url));
        }
        return NextResponse.next();
    }

    // 2. Protection for Dashboard Routes (/agent, /owner, /admin)
    const isAgentRoute = pathname.startsWith('/agent');
    const isOwnerRoute = pathname.startsWith('/owner');
    const isAdminRoute = pathname.startsWith('/admin');

    if (isAgentRoute || isOwnerRoute || isAdminRoute) {
        // No role cookie? Send them to login
        if (!role) {
            return NextResponse.redirect(new URL('/login', request.url));
        }

        // Cross-role protection: Agent trying to access Owner/Admin, etc.
        if (isAgentRoute && role !== 'agent') {
            return NextResponse.redirect(new URL('/owner', request.url));
        }
        if ((isOwnerRoute || isAdminRoute) && role === 'agent') {
            return NextResponse.redirect(new URL('/agent', request.url));
        }
    }

    return NextResponse.next();
}

/**
 * Configure the matcher to EXCLUDE Next.js internal paths and public assets.
 * This prevents the proxy from interfering with JS chunks or images.
 */
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - manifest.json (PWA manifest)
         * - sw.js (service worker)
         */
        '/((?!api|_next/static|_next/image|favicon.ico|manifest.json|sw.js).*)',
    ],
};
