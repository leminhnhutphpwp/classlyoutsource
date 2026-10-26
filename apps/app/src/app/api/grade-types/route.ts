import { NextRequest } from 'next/server';
import { handleBackendRequest } from '@/lib/api-route-helper';

export async function GET(request: NextRequest) {
  // Forward all query params to backend
  const searchParams = request.nextUrl.searchParams;
  const queryString = searchParams.toString();
  const url = queryString 
    ? `/api/v1/grade-types?${queryString}`
    : '/api/v1/grade-types';
  
  return handleBackendRequest(request, 'GET', url, { requireAuth: true });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  return handleBackendRequest(request, 'POST', '/api/v1/grade-types', { requireAuth: true, body });
}
