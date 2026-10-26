import { NextRequest } from 'next/server';
import { handleBackendRequest } from '@/lib/api-route-helper';

/**
 * Generic catch-all BFF proxy.
 *
 * Forwards a same-origin request `/api/<segments>` to the Laravel backend at
 * `/api/v1/<segments>` via `handleBackendRequest`, mirroring the standard
 * boilerplate route handlers:
 *   - requireAuth defaults to true (token from HttpOnly cookie / Bearer header),
 *   - the request body is forwarded for write methods (POST/PUT/PATCH),
 *   - the query string is forwarded automatically by handleBackendRequest
 *     (its default `request.nextUrl.searchParams` fallback).
 *
 * Bespoke handlers (auth/cookies, file download/stream, non-mirror backend
 * paths, FormData uploads, custom response processing, requireAuth:false, etc.)
 * live in their own more-specific route files and take precedence over this
 * catch-all in Next.js routing.
 */

type RouteContext = { params: Promise<{ path: string[] }> };

async function buildEndpoint(context: RouteContext): Promise<string> {
  const { path } = await context.params;
  // path is already URL-decoded per segment by Next; re-encode nothing here to
  // keep parity with the boilerplate handlers that interpolated raw segments.
  return `/api/v1/${path.join('/')}`;
}

/**
 * Read the request body for write methods without throwing on empty/malformed
 * payloads. Boilerplate handlers variously used `request.json()`,
 * `request.json().catch(() => ({}))`, or read no body at all; parsing defensively
 * and forwarding only what the client sent covers every case identically.
 */
async function readBody(request: NextRequest): Promise<unknown | undefined> {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
    try {
      return await request.formData();
    } catch {
      return undefined;
    }
  }

  // Default to JSON (the only body type the boilerplate proxies ever handled).
  try {
    const text = await request.text();
    if (!text) return undefined;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch {
    return undefined;
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  const endpoint = await buildEndpoint(context);
  return handleBackendRequest(request, 'GET', endpoint, { requireAuth: true });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const endpoint = await buildEndpoint(context);
  const body = await readBody(request);
  return handleBackendRequest(request, 'POST', endpoint, { requireAuth: true, body });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const endpoint = await buildEndpoint(context);
  const body = await readBody(request);
  return handleBackendRequest(request, 'PUT', endpoint, { requireAuth: true, body });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const endpoint = await buildEndpoint(context);
  const body = await readBody(request);
  return handleBackendRequest(request, 'PATCH', endpoint, { requireAuth: true, body });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const endpoint = await buildEndpoint(context);
  return handleBackendRequest(request, 'DELETE', endpoint, { requireAuth: true });
}
