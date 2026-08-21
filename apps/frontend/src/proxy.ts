import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Fish Market Server-Side Route Guard & Proxy
 * Enforces role-based redirection.
 */
export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    
    // Get role from cookies (synced by AuthContext)
    const roleCookie = request.cookies.get('fm_role')?.value;
    const role = roleCookie?.toLowerCase(); // 'agent' | 'owner' | 'admin' | 'buyer'
    const homePath =
        role === 'admin' || role === 'owner'
            ? '/owner'
            : role === 'buyer'
                ? '/marketplace'
                : '/agent';
    
    // 1. Redirection for Auth Pages (/login, /register)
    // If the user already has a valid role, keep them away from login/register
    if (pathname === '/login' || pathname === '/register') {
        if (role) {
            // Redirecting logged-in user
            return NextResponse.redirect(new URL(homePath, request.url));
        }
        return NextResponse.next();
    }

    // 2. Protection for Dashboard Routes (/agent, /owner, /admin, /marketplace)
    const isAgentRoute = pathname.startsWith('/agent');
    const isOwnerRoute = pathname.startsWith('/owner');
    const isAdminRoute = pathname.startsWith('/admin');
    const isBuyerRoute = pathname.startsWith('/marketplace');

    if (isAgentRoute || isOwnerRoute || isAdminRoute || isBuyerRoute) {
        // No role cookie? Send them to login
        if (!role) {
            return NextResponse.redirect(new URL('/login', request.url));
        }

        // Cross-role protection: Agent trying to access Owner/Admin, etc.
        if (isAgentRoute && role !== 'agent') {
            return NextResponse.redirect(new URL(homePath, request.url));
        }
        if ((isOwnerRoute || isAdminRoute) && role !== 'owner' && role !== 'admin') {
            return NextResponse.redirect(new URL(homePath, request.url));
        }
        if (isBuyerRoute && role !== 'buyer') {
            return NextResponse.redirect(new URL(homePath, request.url));
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
