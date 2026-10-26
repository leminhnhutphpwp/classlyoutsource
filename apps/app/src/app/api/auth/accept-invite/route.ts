import { NextRequest, NextResponse } from 'next/server';
import { handleBackendRequest } from '@/lib/api-route-helper';
import { setAuthCookies } from '@/lib/cookie-utils';

/**
 * Accept a student/parent invite (PUBLIC).
 *
 * Clones the login handler: forwards {token, password, password_confirmation,
 * name?} to Laravel `/api/v1/auth/accept-invite` without an auth token. The
 * backend creates/activates the account and returns tokens, so on success we
 * set the HttpOnly auth cookies to log the user in.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const response = await handleBackendRequest(request, 'POST', '/api/v1/auth/accept-invite', {
    requireAuth: false,
    body,
  });

  let data: any;
  try {
    data = await response.clone().json();
  } catch {
    return response;
  }

  if (
    (response.status === 200 || response.status === 201) &&
    data?.success &&
    data?.data?.token &&
    data?.data?.refresh_token
  ) {
    // Move tokens into HttpOnly cookies and strip them from the body (S2).
    const token = data.data.token;
    const refreshToken = data.data.refresh_token;
    delete data.data.token;
    delete data.data.refresh_token;
    delete data.token;
    delete data.refresh_token;

    const nextResponse = NextResponse.json(data, {
      status: response.status,
      headers: { ...Object.fromEntries(response.headers.entries()) },
    });
    setAuthCookies(nextResponse, token, refreshToken);
    return nextResponse;
  }

  return response;
}
