import { NextRequest } from 'next/server';
import { handleBackendRequest, buildBackendUrl } from '@/lib/api-route-helper';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const url = buildBackendUrl(request, '/api/v1/reports/revenue');
  return handleBackendRequest(request, 'GET', url, { requireAuth: true });
}

