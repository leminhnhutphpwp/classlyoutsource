import { NextRequest } from 'next/server';
import { handleBackendRequest } from '@/lib/api-route-helper';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params;
  // Backend route is /api/v1/students/{studentId}/attendance
  return handleBackendRequest(request, 'GET', `/api/v1/students/${studentId}/attendance`, { requireAuth: true });
}
