import { NextRequest } from 'next/server';
import { handleBackendRequest } from '@/lib/api-route-helper';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const queryString = searchParams.toString();
  
  const url = queryString
    ? `/api/v1/grade-levels?${queryString}`
    : '/api/v1/grade-levels';
    
  return handleBackendRequest(request, 'GET', url, { requireAuth: true });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  return handleBackendRequest(request, 'POST', '/api/v1/grade-levels', { requireAuth: true, body });
}
