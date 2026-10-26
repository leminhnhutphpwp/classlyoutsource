import { NextRequest, NextResponse } from 'next/server';
import { getRefreshToken, setAuthCookies } from '@/lib/cookie-utils';
import { ensureProtocol } from '@/lib/api-route-helper';

// Always keep a scheme: a raw fetch() to a scheme-less URL throws (S8).
const BACKEND_URL = ensureProtocol(process.env.BACKEND_URL || 'http://localhost:8000');

/**
 * Refresh token endpoint - public endpoint, receives refresh_token from cookie or body
 * Backend will rotate refresh token (create new, invalidate old)
 */
export async function POST(req: NextRequest) {
  try {
    // Get refresh_token from cookie first, fallback to body
    let refreshToken = getRefreshToken(req);
    if (!refreshToken) {
      const body = await req.json();
      refreshToken = body?.refresh_token;
    }

    if (!refreshToken) {
      return NextResponse.json(
        { success: false, message: 'Refresh token required', code: 'UNAUTHENTICATED' },
        { status: 401 }
      );
    }

    // Forward request to backend - public endpoint, send refresh_token in body
    const response = await fetch(`${BACKEND_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        // No Authorization header - refresh endpoint is public
      },
      body: JSON.stringify({
        refresh_token: refreshToken
      }),
    });

    let responseData: any;
    try {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        responseData = await response.json();
      } else {
        return NextResponse.json(
          { success: false, message: `Phản hồi không hợp lệ từ máy chủ (Status: ${response.status})` },
          { status: response.status || 500 }
        );
      }
    } catch (_parseError) {
      return NextResponse.json(
        { success: false, message: `Phản hồi không hợp lệ từ máy chủ (Status: ${response.status})` },
        { status: response.status || 500 }
      );
    }

    // Capture rotated tokens for the cookies, then strip them from the body (S2)
    // so the raw JWT + refresh token never reach client JS.
    const rotatedToken = responseData?.data?.token;
    const rotatedRefreshToken = responseData?.data?.refresh_token;
    if (responseData?.data) {
      delete responseData.data.token;
      delete responseData.data.refresh_token;
    }
    if (responseData && typeof responseData === 'object') {
      delete responseData.token;
      delete responseData.refresh_token;
    }

    // Normalize response format
    let finalResponse: NextResponse;

    if (typeof responseData === 'object' && responseData !== null && 'success' in responseData) {
      finalResponse = NextResponse.json(responseData, { status: response.status });
    } else if (response.ok) {
      finalResponse = NextResponse.json(
        {
          success: true,
          message: responseData?.message || 'Thành công',
          data: responseData?.data || responseData
        },
        { status: response.status }
      );
    } else {
      finalResponse = NextResponse.json(
        {
          success: false,
          message: responseData?.message || responseData?.error || 'Yêu cầu thất bại',
          ...(responseData?.errors && { errors: responseData.errors }),
          ...(responseData?.code && { code: responseData.code })
        },
        { status: response.status }
      );
    }

    // If refresh successful, update cookies (using the captured rotated tokens)
    if (response.ok && responseData?.success && rotatedToken && rotatedRefreshToken) {
      setAuthCookies(finalResponse, rotatedToken, rotatedRefreshToken);
    }

    return finalResponse;

  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Không thể kết nối đến máy chủ'
      },
      { status: 500 }
    );
  }
}
