import { NextRequest } from 'next/server';
import { handleBackendFileDownload } from '@/lib/api-route-helper';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  // Export DATA: subjects list
  return handleBackendFileDownload(request, '/api/v1/subjects/export', {
    requireAuth: true,
  });
}


