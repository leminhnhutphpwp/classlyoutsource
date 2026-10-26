import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken, getRefreshToken } from '@/lib/cookie-utils';

/**
 * Get current auth token from HttpOnly cookie
 * This endpoint allows client to check authentication status
 * Note: Token is still HttpOnly, this only returns a boolean or token existence check
 */
export async function GET(request: NextRequest) {
  const token = getAuthToken(request);
  const refreshToken = getRefreshToken(request);
  
  return NextResponse.json({
    success: true,
    authenticated: !!token,
    hasRefreshToken: !!refreshToken,
  });
}

