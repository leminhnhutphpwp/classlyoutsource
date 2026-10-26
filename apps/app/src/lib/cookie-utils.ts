/**
 * Cookie utilities for secure token storage
 * Uses HttpOnly cookies to prevent XSS attacks
 */

const TOKEN_COOKIE_NAME = 'auth_token';
const REFRESH_TOKEN_COOKIE_NAME = 'refresh_token';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

/**
 * Set HttpOnly cookie (server-side only)
 * @param response - NextResponse object
 * @param name - Cookie name
 * @param value - Cookie value
 * @param maxAge - Max age in seconds (default: 7 days)
 */
export function setHttpOnlyCookie(
  response: Response,
  name: string,
  value: string,
  maxAge: number = COOKIE_MAX_AGE
): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const isLocalhost = process.env.NEXT_PUBLIC_API_BASE_URL?.includes('localhost') || 
                       process.env.BACKEND_URL?.includes('localhost');
  
  // Build cookie string
  const cookieParts = [
    `${name}=${value}`,
    `Max-Age=${maxAge}`,
    'Path=/',
    'HttpOnly', // Prevent JavaScript access
    // Use Lax for development/localhost to allow cross-origin requests
    // Use Strict for production (same domain)
    `SameSite=${isLocalhost || !isProduction ? 'Lax' : 'Strict'}`, // CSRF protection
    ...(isProduction && !isLocalhost ? ['Secure'] : []), // HTTPS only in production (not localhost)
  ];

  // Set cookie header - NextResponse supports multiple Set-Cookie headers
  const cookieString = cookieParts.join('; ');
  
  // For NextResponse, we can append multiple Set-Cookie headers
  // Check if response is NextResponse (has cookies method)
  if ('cookies' in response && typeof (response as any).cookies?.set === 'function') {
    // NextResponse has cookies API
    (response as any).cookies.set(name, value, {
      maxAge,
      path: '/',
      httpOnly: true,
      sameSite: (isLocalhost || !isProduction) ? 'lax' : 'strict',
      secure: isProduction && !isLocalhost,
    });
  } else {
    // Fallback: Use Set-Cookie header directly
    // Get existing Set-Cookie headers
    const existingCookies = response.headers.getSetCookie();
    if (existingCookies.length > 0) {
      // Append to existing cookies
      response.headers.append('Set-Cookie', cookieString);
    } else {
      // Set new cookie header
      response.headers.set('Set-Cookie', cookieString);
    }
  }
}

/**
 * Clear HttpOnly cookie (server-side only)
 * @param response - NextResponse object
 * @param name - Cookie name
 */
export function clearHttpOnlyCookie(response: Response, name: string): void {
  // Set cookie to expire in the past to ensure it's deleted
  const expiredDate = new Date(0).toUTCString();
  
  // Check if response is NextResponse (has cookies method)
  if ('cookies' in response && typeof (response as any).cookies?.delete === 'function') {
    // NextResponse has cookies API - use delete method
    (response as any).cookies.delete(name);
  } else if ('cookies' in response && typeof (response as any).cookies?.set === 'function') {
    // Fallback: Set cookie with empty value and expired date
    (response as any).cookies.set(name, '', {
      maxAge: 0,
      expires: new Date(0),
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
    });
  } else {
    // Fallback: Use Set-Cookie header directly with expired date
    const cookieParts = [
      `${name}=`,
      `Expires=${expiredDate}`,
      'Max-Age=0',
      'Path=/',
      'HttpOnly',
      'SameSite=Strict',
    ];
    response.headers.set('Set-Cookie', cookieParts.join('; '));
  }
}

/**
 * Get cookie value from request (server-side only)
 * @param request - NextRequest object
 * @param name - Cookie name
 * @returns Cookie value or null
 */
export function getCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map(c => c.trim());
  const cookie = cookies.find(c => c.startsWith(`${name}=`));
  
  if (!cookie) return null;
  
  return cookie.split('=')[1] || null;
}

/**
 * Set auth tokens in HttpOnly cookies
 * @param response - NextResponse object
 * @param token - Access token
 * @param refreshToken - Refresh token
 */
export function setAuthCookies(
  response: Response,
  token: string,
  refreshToken: string
): void {
  setHttpOnlyCookie(response, TOKEN_COOKIE_NAME, token);
  setHttpOnlyCookie(response, REFRESH_TOKEN_COOKIE_NAME, refreshToken);
}

/**
 * Clear auth cookies
 * @param response - NextResponse object
 */
export function clearAuthCookies(response: Response): void {
  clearHttpOnlyCookie(response, TOKEN_COOKIE_NAME);
  clearHttpOnlyCookie(response, REFRESH_TOKEN_COOKIE_NAME);
}

/**
 * Get auth token from request cookies
 * @param request - NextRequest object
 * @returns Access token or null
 */
export function getAuthToken(request: Request): string | null {
  return getCookie(request, TOKEN_COOKIE_NAME);
}

/**
 * Get refresh token from request cookies
 * @param request - NextRequest object
 * @returns Refresh token or null
 */
export function getRefreshToken(request: Request): string | null {
  return getCookie(request, REFRESH_TOKEN_COOKIE_NAME);
}

