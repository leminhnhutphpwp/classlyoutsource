import { NextRequest } from 'next/server';
import { handleBackendRequest } from '@/lib/api-route-helper';

export async function POST(request: NextRequest) {
  // Handle multipart/form-data for file upload
  const formData = await request.formData();
  return handleBackendRequest(request, 'POST', '/api/v1/media/upload', {
    requireAuth: true,
    body: formData,
  });
}

