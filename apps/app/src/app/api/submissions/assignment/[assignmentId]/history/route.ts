import { NextRequest } from 'next/server';
import { handleBackendRequest } from '@/lib/api-route-helper';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  const { assignmentId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const studentId = searchParams.get('student_id');
  
  let url = `/api/v1/submissions/assignment/${assignmentId}/history`;
  if (studentId) {
    url += `?student_id=${studentId}`;
  }
  
  return handleBackendRequest(request, 'GET', url, { requireAuth: true });
}

