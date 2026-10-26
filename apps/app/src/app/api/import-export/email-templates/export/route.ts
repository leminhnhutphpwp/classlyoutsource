import { NextRequest } from 'next/server';
import { handleBackendRequest } from '@/lib/api-route-helper';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  return handleBackendRequest(request, 'GET', '/api/v1/email-templates/export', { requireAuth: true });
}

