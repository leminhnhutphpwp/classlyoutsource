import { NextRequest } from 'next/server';
import { handleBackendFileDownload } from '@/lib/api-route-helper';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  // Export DATA: danh sách học viên (raw list) theo đúng docs:
  // GET /api/v1/students/export
  return handleBackendFileDownload(request, '/api/v1/students/export', {
    requireAuth: true,
  });
}


