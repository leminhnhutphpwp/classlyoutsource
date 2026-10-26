import { NextRequest } from 'next/server';
import { handleBackendRequest } from '@/lib/api-route-helper';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  const { classId } = await params;
  // Backend route is /api/v1/classes/{classId}/assignments
  return handleBackendRequest(request, 'GET', `/api/v1/classes/${classId}/assignments`, { requireAuth: true });
}
