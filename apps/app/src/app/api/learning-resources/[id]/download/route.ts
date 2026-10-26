import { NextRequest } from 'next/server';
import { handleBackendFileDownload } from '@/lib/api-route-helper';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handleBackendFileDownload(request, `/api/v1/learning-resources/${id}/download`, { requireAuth: true });
}

