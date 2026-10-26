import { NextRequest, NextResponse } from 'next/server';
import { handleBackendRequest } from '@/lib/api-route-helper';
import { setAuthCookies } from '@/lib/cookie-utils';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const response = await handleBackendRequest(request, 'POST', '/api/v1/auth/login', { requireAuth: false, body });
  
  // Read response data
  let data: any;
  try {
    // Clone response để có thể đọc mà không ảnh hưởng đến response gốc
    const responseClone = response.clone();
    data = await responseClone.json();
  } catch {
    // If response is not JSON, return original response
    return response;
  }
  
  // If login successful, set HttpOnly cookies
  if (response.status === 200 && data.success && data.data?.token && data.data?.refresh_token) {
    // Capture tokens for the cookies, then strip them from the response body
    // so the raw JWT / refresh token never reaches client JS (S2).
    const token = data.data.token;
    const refreshToken = data.data.refresh_token;
    delete data.data.token;
    delete data.data.refresh_token;
    delete data.token;
    delete data.refresh_token;

    // Create new response with the token-stripped data
    const nextResponse = NextResponse.json(data, {
      status: response.status,
      headers: {
        // Copy important headers from original response
        ...Object.fromEntries(response.headers.entries()),
      }
    });

    // Set cookies with tokens - MUST be done on NextResponse, not regular Response
    setAuthCookies(nextResponse, token, refreshToken);

    return nextResponse;
  }
  
  return response;
}
