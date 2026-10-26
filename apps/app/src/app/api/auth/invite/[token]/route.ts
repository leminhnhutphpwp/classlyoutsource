import { NextRequest } from 'next/server';
import { handleBackendRequest } from '@/lib/api-route-helper';

type RouteContext = { params: Promise<{ token: string }> };

/**
 * Look up an invite by token (PUBLIC, no cookies).
 *
 * Forwards to Laravel `GET /api/v1/auth/invite/{token}` without auth so the
 * accept-invite page can show who invited the user and in which role. Backend
 * returns 410 when the invite is invalid/expired — that status is passed through.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { token } = await context.params;
  return handleBackendRequest(
    request,
    'GET',
    `/api/v1/auth/invite/${encodeURIComponent(token)}`,
    { requireAuth: false }
  );
}
