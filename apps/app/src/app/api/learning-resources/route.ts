import { NextRequest } from 'next/server';
import { handleBackendRequest } from '@/lib/api-route-helper';

export async function GET(request: NextRequest) {
  // Forward all query params to backend
  const searchParams = request.nextUrl.searchParams;
  const queryString = searchParams.toString();
  const url = queryString 
    ? `/api/v1/learning-resources?${queryString}`
    : '/api/v1/learning-resources';
  
  return handleBackendRequest(request, 'GET', url, { requireAuth: true });
}

export async function POST(request: NextRequest) {
  // Handle multipart/form-data for file upload
  const formData = await request.formData();
  return handleBackendRequest(request, 'POST', '/api/v1/learning-resources', {
    requireAuth: true,
    body: formData,
  });
}

