import { NextRequest } from 'next/server';
import { handleBackendFileDownload } from '@/lib/api-route-helper';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  return handleBackendFileDownload(request, '/api/v1/reports/assignments/export', { requireAuth: true });
}

