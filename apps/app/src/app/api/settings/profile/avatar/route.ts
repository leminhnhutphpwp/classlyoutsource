import { NextRequest } from 'next/server';
import { handleBackendRequest } from '@/lib/api-route-helper';

export async function POST(request: NextRequest) {
  // Handle FormData for file upload
  const formData = await request.formData();
  return handleBackendRequest(request, 'POST', '/api/v1/settings/profile/avatar', { 
    requireAuth: true, 
    body: formData 
  });
}

