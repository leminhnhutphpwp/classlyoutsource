import { NextRequest } from 'next/server';
import { handleBackendRequest } from '@/lib/api-route-helper';

export async function POST(request: NextRequest) {
  const body = await request.json();
  return handleBackendRequest(request, 'POST', '/api/v1/auth/verify-email', { requireAuth: true, body });
}

