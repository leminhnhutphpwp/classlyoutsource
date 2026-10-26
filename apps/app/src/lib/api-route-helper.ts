import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/cookie-utils';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

/**
 * Ensure URL has proper protocol
 */
export function ensureProtocol(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // Default to http for development
  return `http://${url}`;
}

/**
 * Normalize response từ Laravel backend
 * Backend trả về { success, message, data } hoặc { success, message, errors, code }
 */
export function normalizeBackendResponse(responseData: any, responseStatus: number) {
  if (typeof responseData === 'object' && responseData !== null && 'success' in responseData) {
    return responseData;
  }

  if (responseStatus >= 200 && responseStatus < 300) {
    return {
      success: true,
      message: responseData?.message || 'Thành công',
      data: responseData?.data || responseData
    };
  }

  return {
    success: false,
    message: responseData?.message || responseData?.error || 'Yêu cầu thất bại',
    ...(responseData?.errors && { errors: responseData.errors }),
    ...(responseData?.code && { code: responseData.code })
  };
}

/**
 * Xử lý API request đến Laravel backend và normalize response
 */
export async function handleBackendRequest(
  request: NextRequest,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  endpoint: string,
  options?: {
    requireAuth?: boolean;
    body?: any;
    queryParams?: URLSearchParams;
  }
): Promise<NextResponse> {
  try {
    const { requireAuth = true, body, queryParams } = options || {};

    // Get token from cookie first, fallback to Authorization header
    let token: string | null = null;
    if (requireAuth) {
      // Try to get token from HttpOnly cookie first
      token = getAuthToken(request);

      // Fallback to Authorization header (for backward compatibility or direct API calls)
      if (!token) {
        const authHeader = request.headers.get('authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
          token = authHeader.replace('Bearer ', '');
        }
      }

      // If still no token, return error
      if (!token) {
        return NextResponse.json(
          { success: false, message: 'Token required. Please login again.' },
          { status: 401 }
        );
      }
    }

    const userAgent = request.headers.get('user-agent') || '';
    const realIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '';

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Accept': 'application/json',
        'X-User-Agent': userAgent,
        'X-Real-IP': realIp,
        ...(requireAuth && token && {
          'Authorization': `Bearer ${token}`
        }),
      },
    };

    if (body !== null && body !== undefined && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      // Handle FormData (for file uploads)
      // Check if body is FormData - need to check both global FormData and Next.js FormData
      let isFormData = false;

      try {
        // Multiple ways to check if it's FormData:
        // 1. instanceof FormData (standard check)
        // 2. Check for entries method (FormData-like object)
        // 3. Check constructor name
        // 4. Check for FormData-specific methods
        if (body instanceof FormData) {
          isFormData = true;
        } else if (typeof body === 'object' && body !== null) {
          const bodyAny = body as any;
          // Check for FormData-like properties
          if (
            (typeof bodyAny.entries === 'function') ||
            (typeof bodyAny.append === 'function' && typeof bodyAny.get === 'function') ||
            (bodyAny.constructor && (bodyAny.constructor.name === 'FormData' || bodyAny.constructor.name === 'FormDataImpl'))
          ) {
            isFormData = true;
          }
        }
      } catch {
        // If check fails, assume it's not FormData
        isFormData = false;
      }

      if (isFormData) {
        // Handle FormData from form-data package or global FormData
        try {
          const bodyAny = body as any;

          // Check if it's form-data package FormData (has getHeaders method)
          if (bodyAny && typeof bodyAny.getHeaders === 'function') {
            // form-data package - use stream directly
            // Don't set Content-Type header manually - let form-data package handle it
            // The stream from form-data package should work with fetch API
            try {
              const headers = bodyAny.getHeaders();

              // Don't manually set Content-Type - form-data package handles boundary
              // But we need to keep Authorization header
              const currentHeaders = fetchOptions.headers as Record<string, string> || {};
              const authHeader = currentHeaders['Authorization'] || currentHeaders['authorization'];

              if (headers && typeof headers === 'object') {
                // Set headers from form-data package, but preserve Authorization
                const mergedHeaders: Record<string, string> = {
                  ...headers,
                };
                if (authHeader) {
                  mergedHeaders['Authorization'] = authHeader;
                }
                fetchOptions.headers = mergedHeaders as HeadersInit;
              } else if (authHeader) {
                // If no headers from form-data, at least keep Authorization
                fetchOptions.headers = {
                  ...currentHeaders,
                  'Authorization': authHeader,
                } as HeadersInit;
              }

              // Use form-data stream directly - it should work with fetch in Node.js
              // The form-data package creates a stream that fetch can consume
              fetchOptions.body = bodyAny as any;
            } catch {
              // If getHeaders fails, try to use body directly
              fetchOptions.body = bodyAny as any;
            }
          } else {
            // Global FormData or Next.js FormData - let fetch handle it
            // Don't set Content-Type header - browser/fetch will set it with boundary
            if (body !== null && body !== undefined) {
              // Check if it's a FormData-like object

              fetchOptions.body = body as FormData;
            } else {
              return NextResponse.json(
                {
                  success: false,
                  message: 'FormData body is null or undefined'
                },
                { status: 400 }
              );
            }
          }
        } catch (error) {
          return NextResponse.json(
            {
              success: false,
              message: 'Lỗi khi xử lý FormData: ' + (error instanceof Error ? error.message : 'Unknown error')
            },
            { status: 400 }
          );
        }
      } else {
        // Handle JSON body
        try {
          fetchOptions.headers = {
            ...fetchOptions.headers,
            'Content-Type': 'application/json',
          };
          fetchOptions.body = JSON.stringify(body);
        } catch (error) {
          return NextResponse.json(
            {
              success: false,
              message: 'Lỗi khi xử lý JSON body: ' + (error instanceof Error ? error.message : 'Unknown error')
            },
            { status: 400 }
          );
        }
      }
    }

    let url = `${ensureProtocol(BACKEND_URL)}${endpoint}`;
    // Add query parameters - prioritize provided queryParams, otherwise use request query params
    const searchParams = queryParams || request.nextUrl.searchParams;
    if (searchParams && searchParams.toString()) {
      const queryString = searchParams.toString();
      url += (url.includes('?') ? '&' : '?') + queryString;
    }

    let response: Response;

    try {
      response = await fetch(url, fetchOptions);
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: 'Không thể kết nối đến máy chủ. Vui lòng thử lại sau.'
        },
        { status: 500 }
      );
    }

    let responseData: any;
    try {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        responseData = await response.json();
      } else {
        return NextResponse.json(
          {
            success: false,
            message: `Phản hồi không hợp lệ từ máy chủ (Status: ${response.status})`
          },
          { status: response.status || 500 }
        );
      }
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: `Phản hồi không hợp lệ từ máy chủ (Status: ${response.status})`
        },
        { status: response.status || 500 }
      );
    }

    const normalizedResponse = normalizeBackendResponse(responseData, response.status);
    return NextResponse.json(normalizedResponse, { status: response.status });
  } catch (error) {
    // Sanitize error message to prevent exposing server domain/URL
    let errorMessage = 'Không thể kết nối đến máy chủ. Vui lòng thử lại sau.';
    if (error instanceof Error) {
      // Remove any URLs/domains from error message
      let sanitized = error.message
        .replace(/https?:\/\/[^\s]+/gi, '[server]')
        .replace(/[a-zA-Z0-9.-]+\.(com|net|org|io|online|dev|local|test|vn|edu|gov|co|uk|au|ca|jp|kr|cn|ru|de|fr|es|it|nl|pl|br|mx|in|id|ph|sg|my|th|tw|hk)[^\s]*/gi, '[server]')
        .replace(/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|EAI_AGAIN/gi, '')
        .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[server]')
        .replace(/:\d{1,5}/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      // Double check: remove BACKEND_URL if it somehow still exists
      sanitized = sanitized.replace(new RegExp(BACKEND_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '[server]');

      if (sanitized.trim() && sanitized.length > 0) {
        errorMessage = sanitized;
      }
    }
    return NextResponse.json(
      {
        success: false,
        message: errorMessage
      },
      { status: 500 }
    );
  }
}

/**
 * Helper để forward query params từ Next.js request sang backend
 * @param request Next.js request object
 * @param baseEndpoint Backend endpoint path (e.g., '/api/v1/reports/overview')
 * @returns Full backend URL with query params
 */
export function buildBackendUrl(request: NextRequest, baseEndpoint: string): string {
  const searchParams = request.nextUrl.searchParams;
  const queryString = searchParams.toString();
  return queryString ? `${baseEndpoint}?${queryString}` : baseEndpoint;
}

/**
 * Xử lý file download request từ Laravel backend
 * Proxy file response (blob) từ backend đến client
 */
export async function handleBackendFileDownload(
  request: NextRequest,
  endpoint: string,
  options?: {
    requireAuth?: boolean;
    skipAuthHeader?: boolean; // For media endpoints that only need token in query params, not Authorization header
  }
): Promise<NextResponse> {
  try {
    const { requireAuth = true, skipAuthHeader = false } = options || {};

    // Get search params for building URL and token extraction
    const searchParams = request.nextUrl.searchParams;

    // Get token from cookie first, fallback to Authorization header or query params
    let token: string | null = null;
    if (requireAuth) {
      // Try to get token from HttpOnly cookie first (same as handleBackendRequest)
      token = getAuthToken(request);

      // Fallback to Authorization header (for backward compatibility or direct API calls)
      if (!token) {
        const authHeader = request.headers.get('authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
          token = authHeader.replace('Bearer ', '');
        }
      }

      // Fallback to query params (for signed URLs)
      if (!token && searchParams.has('token')) {
        token = searchParams.get('token');
      }

      if (!token) {
        return NextResponse.json(
          { success: false, message: 'Token required' },
          { status: 401 }
        );
      }
    }

    const userAgent = request.headers.get('user-agent') || '';
    const realIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '';

    const fetchOptions: RequestInit = {
      method: 'GET',
      headers: {
        'Accept': '*/*',
        'X-User-Agent': userAgent,
        'X-Real-IP': realIp,
        // Only add Authorization header if skipAuthHeader is false (media endpoints don't need JWT)
        ...(!skipAuthHeader && token && {
          'Authorization': `Bearer ${token}`
        }),
      },
    };

    // Build URL with query params (keep token in query params for backend validation)
    const queryString = searchParams.toString();
    const url = `${ensureProtocol(BACKEND_URL)}${endpoint}${queryString ? `?${queryString}` : ''}`;

    let response: Response;
    try {
      response = await fetch(url, fetchOptions);
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: 'Không thể kết nối đến máy chủ. Vui lòng thử lại sau.'
        },
        { status: 500 }
      );
    }

    if (!response.ok) {
      // Try to parse error response
      try {
        const errorData = await response.json();
        return NextResponse.json(
          {
            success: false,
            message: errorData.message || `Export failed: ${response.status} ${response.statusText}`
          },
          { status: response.status }
        );
      } catch {
        return NextResponse.json(
          {
            success: false,
            message: `Export failed: ${response.status} ${response.statusText}`
          },
          { status: response.status }
        );
      }
    }

    // Get file content type and content disposition from backend
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentDisposition = response.headers.get('content-disposition') || '';

    // Get blob from response
    const blob = await response.blob();

    // Return file response with proper headers
    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition,
        'Content-Length': blob.size.toString(),
      },
    });
  } catch (error) {
    // Sanitize error message to prevent exposing server domain/URL
    let errorMessage = 'Không thể xuất file. Vui lòng thử lại sau.';
    if (error instanceof Error) {
      // Remove any URLs/domains from error message
      let sanitized = error.message
        .replace(/https?:\/\/[^\s]+/gi, '[server]')
        .replace(/[a-zA-Z0-9.-]+\.(com|net|org|io|online|dev|local|test|vn|edu|gov|co|uk|au|ca|jp|kr|cn|ru|de|fr|es|it|nl|pl|br|mx|in|id|ph|sg|my|th|tw|hk)[^\s]*/gi, '[server]')
        .replace(/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|EAI_AGAIN/gi, '')
        .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[server]')
        .replace(/:\d{1,5}/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      // Double check: remove BACKEND_URL if it somehow still exists
      sanitized = sanitized.replace(new RegExp(BACKEND_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '[server]');

      if (sanitized.trim() && sanitized.length > 0) {
        errorMessage = sanitized;
      }
    }
    return NextResponse.json(
      {
        success: false,
        message: errorMessage
      },
      { status: 500 }
    );
  }
}