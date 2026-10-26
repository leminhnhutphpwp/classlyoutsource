import { NextRequest } from 'next/server';
import { handleBackendRequest } from '@/lib/api-route-helper';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  return handleBackendRequest(request, 'POST', '/api/v1/subjects/import', {
    requireAuth: true,
    body: formData,
  });
}


