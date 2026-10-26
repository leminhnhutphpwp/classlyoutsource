import { NextRequest } from 'next/server';
import { handleBackendRequest } from '@/lib/api-route-helper';

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Public endpoint: không yêu cầu Authorization header
  return handleBackendRequest(request, 'POST', '/api/v1/auth/verify-code', {
    requireAuth: false,
    body,
  });
}


