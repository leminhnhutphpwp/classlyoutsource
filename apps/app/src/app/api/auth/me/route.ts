import { NextRequest } from 'next/server';
import { handleBackendRequest } from '@/lib/api-route-helper';

export async function GET(request: NextRequest) {
  return handleBackendRequest(request, 'GET', '/api/v1/auth/me');
}
