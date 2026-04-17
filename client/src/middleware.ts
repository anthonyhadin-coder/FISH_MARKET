import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Edge Middleware — Role-based Route Protection
 *
 * Reads the `fm_role` cookie that AuthContext sets on login.
 * Redirects unauthenticated / unauthorised requests before the page renders.
 *
 * NOTE: fm_role is a non-HttpOnly cookie (intentionally) so middleware can read it.
 * The authoritative session check is the HttpOnly `access_token` cookie verified
 * server-side on every API call. This middleware is the UX fast-path only.
 */

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password'];

/** Role → allowed path prefixes */
const ROLE_PATHS: Record<string, string[]> = {
  owner: ['/owner', '/admin'],
  admin: ['/owner', '/admin'],
  agent: ['/staff'],
  buyer: ['/customer'],
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public auth routes, static assets and API routes
  if (
    PUBLIC_PATHS.some(p => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/' ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const role = request.cookies.get('fm_role')?.value?.toLowerCase();

  // No role cookie → redirect to login
  if (!role) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('reason', 'unauthenticated');
    return NextResponse.redirect(loginUrl);
  }

  // Role → path enforcement
  const allowed = ROLE_PATHS[role] ?? [];
  const hasAccess = allowed.some(prefix => pathname.startsWith(prefix));

  if (!hasAccess) {
    // Redirect to the role's home instead of a 403
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = allowed[0] ?? '/login';
    homeUrl.searchParams.delete('reason');
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon.ico, manifest.json, sw.js, images/
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|images/).*)',
  ],
};
