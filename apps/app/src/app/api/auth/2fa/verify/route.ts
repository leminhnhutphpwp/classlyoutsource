import { NextRequest, NextResponse } from 'next/server';
import { handleBackendRequest } from '@/lib/api-route-helper';
import { setAuthCookies } from '@/lib/cookie-utils';

/**
 * 2FA login step 2 (bespoke BFF route).
 *
 * This is the second half of login and therefore mirrors `/api/auth/login`: it must set the
 * HttpOnly auth cookies server-side, which the generic catch-all proxy cannot do. It forwards
 * { challenge, code } to Laravel and, on success, moves the returned JWT + refresh token into
 * HttpOnly cookies so the tokens never touch client JS — exactly like a normal password login.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const response = await handleBackendRequest(request, 'POST', '/api/v1/auth/2fa/verify', {
    requireAuth: false,
    body,
  });

  let data: any;
  try {
    const responseClone = response.clone();
    data = await responseClone.json();
  } catch {
    return response;
  }

  if (response.status === 200 && data.success && data.data?.token && data.data?.refresh_token) {
    // Move tokens into HttpOnly cookies and strip them from the body (S2) so the
    // raw JWT + refresh token never touch client JS.
    const token = data.data.token;
    const refreshToken = data.data.refresh_token;
    delete data.data.token;
    delete data.data.refresh_token;
    delete data.token;
    delete data.refresh_token;

    const nextResponse = NextResponse.json(data, {
      status: response.status,
      headers: {
        ...Object.fromEntries(response.headers.entries()),
      },
    });

    setAuthCookies(nextResponse, token, refreshToken);

    return nextResponse;
  }

  return response;
}
