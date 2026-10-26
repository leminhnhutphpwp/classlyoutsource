import { NextRequest } from 'next/server';
import { handleBackendRequest } from '@/lib/api-route-helper';

export async function POST(request: NextRequest) {
  return handleBackendRequest(request, 'POST', '/api/v1/auth/send-verification-email', { requireAuth: true });
}

