import { NextRequest } from 'next/server';
import { handleBackendRequest } from '@/lib/api-route-helper';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const body = await request.json();
  return handleBackendRequest(request, 'POST', '/api/v1/email-templates/import', {
    requireAuth: true,
    body,
  });
}

