import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Các đường dẫn không yêu cầu đăng nhập (Public Routes)
const PUBLIC_PATHS = [
  '/auth/sign-in',
  '/auth/sign-up',
  '/auth/accept-invite',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-code',
  '/auth/verify-email',
  '/terms',
  '/privacy',
  // Nếu trang chủ '/' là Landing page public thì để ở đây. 
  // Nếu '/' là Dashboard redirect thì xóa dòng dưới.
  // '/', 
];

// Các đường dẫn chỉ dành cho người CHƯA đăng nhập (Auth Routes)
// Nếu đã đăng nhập mà vào đây sẽ bị đá về Dashboard
const AUTH_PATHS = [
  '/auth/sign-in',
  '/auth/sign-up',
  '/auth/forgot-password',
  '/auth/reset-password',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for static files, API routes, and Next.js internals
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/static/') ||
    pathname.includes('.') || // Skip files with extensions (images, css, js, etc.)
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  ) {
    return NextResponse.next();
  }

  const response = NextResponse.next();

  // --- 1. Security Headers (Updated for Zalo compatibility) ---
  // 'unsafe-eval' is only needed for webpack/React-Refresh HMR in dev; never in prod.
  const isDev = process.env.NODE_ENV !== 'production';
  const apiOrigin = process.env.API_BASE_URL || 'http://localhost:8000';
  const scriptSrc = [
    "script-src 'self' 'unsafe-inline'",
    isDev ? "'unsafe-eval'" : '',
    'https://www.google.com https://www.gstatic.com https://*.zalo.me https://*.zaloapp.com',
  ].filter(Boolean).join(' ');
  const baseSecurityHeaders: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    'Content-Security-Policy': [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data: https://fonts.gstatic.com",
      // Explicit origins only (no bare `https:` wildcard → prevents exfiltration to
      // any https host). Same-origin BFF + the backend API origin.
      `connect-src 'self' ${apiOrigin}`,
      "frame-ancestors 'self' https://*.zalo.me https://*.zaloapp.com",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join('; '),
  };

  // Only set X-Frame-Options for non-Zalo requests
  const userAgent = request.headers.get('user-agent')?.toLowerCase() || '';
  const isZaloRequest = userAgent.includes('zalo') || 
                       request.headers.get('referer')?.includes('zalo') ||
                       request.nextUrl.searchParams.has('zalo_source');
  
  const securityHeaders = { ...baseSecurityHeaders };
  if (!isZaloRequest) {
    securityHeaders['X-Frame-Options'] = 'DENY';
  }

  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  if (request.nextUrl.protocol === 'https:') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // --- 2. Authentication Logic (Re-enabled with better handling) ---
  
  // Kiểm tra token trong cookie (ưu tiên 'auth_token' theo cookie-utils.ts)
  const token = request.cookies.get('auth_token')?.value ||
    request.cookies.get('token')?.value ||
    request.cookies.get('access_token')?.value;
  const isAuthenticated = !!token;

  // Helper: Check if path matches explicit public paths
  const isPublicPath = PUBLIC_PATHS.some(path => pathname === path || pathname.startsWith(path + '/'));

  // Helper: Check if path is strictly an auth page (login)
  const isAuthPath = AUTH_PATHS.some(path => pathname === path || pathname.startsWith(path + '/'));

  // CASE A: User ĐÃ đăng nhập nhưng cố vào trang Login -> Redirect về Dashboard
  if (isAuthenticated && isAuthPath) {
    const dashboardUrl = new URL('/dashboard', request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  // CASE B: User CHƯA đăng nhập và truy cập root '/' -> Redirect về Login
  if (!isAuthenticated && pathname === '/') {
    const loginUrl = new URL('/auth/sign-in', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // CASE C: User CHƯA đăng nhập nhưng cố vào trang Private (không phải root) -> Redirect về Login với 'from' parameter
  if (!isAuthenticated && !isPublicPath && pathname !== '/') {
    const loginUrl = new URL('/auth/sign-in', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - robots.txt, sitemap.xml (SEO files)
     * - files with extensions (images, css, js, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)',
  ],
};
