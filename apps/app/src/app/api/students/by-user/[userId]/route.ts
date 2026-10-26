import { NextRequest } from 'next/server';
import { handleBackendRequest } from '@/lib/api-route-helper';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  // Backend sẽ filter students by user_id
  // Tạm thời sử dụng API /api/v1/students với filter user_id
  // Nếu backend không hỗ trợ, cần tạo endpoint mới
  return handleBackendRequest(request, 'GET', `/api/v1/students?user_id=${userId}`, { requireAuth: true });
}

