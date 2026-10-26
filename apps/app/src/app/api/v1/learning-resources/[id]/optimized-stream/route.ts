import { NextRequest } from 'next/server';
import { handleBackendFileDownload } from '@/lib/api-route-helper';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // Media endpoints don't require JWT, only media token in query params
  return handleBackendFileDownload(request, `/api/v1/learning-resources/${id}/optimized-stream`, { requireAuth: false, skipAuthHeader: true });
}