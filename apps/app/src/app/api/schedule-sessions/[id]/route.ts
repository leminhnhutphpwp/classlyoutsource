import { NextRequest, NextResponse } from 'next/server';
import { handleBackendRequest } from '@/lib/api-route-helper';
import { getObjId, idsEqual } from '@/lib/id-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Direct backend call (Standard)
  const response = await handleBackendRequest(request, 'GET', `/api/v1/schedule-sessions/${id}`, { requireAuth: true });

  if (response.ok) {
    return response;
  }

  // Workaround: Search through schedules if direct endpoint is not available
  try {
    const schedulesRes = await handleBackendRequest(request, 'GET', '/api/v1/schedules', { requireAuth: true });
    if (!schedulesRes.ok) return response;

    const { data: schedules } = await schedulesRes.json();
    if (!Array.isArray(schedules)) return response;

    for (const schedule of schedules) {
      const sessionsRes = await handleBackendRequest(request, 'GET', `/api/v1/schedules/${getObjId(schedule)}/sessions`, { requireAuth: true });
      if (!sessionsRes.ok) continue;

      const sessionsData = await sessionsRes.json();
      const sessions = sessionsData?.data?.sessions ||
        sessionsData?.sessions ||
        sessionsData?.data?.weeks?.flatMap((w: any) => w.sessions || []) ||
        (Array.isArray(sessionsData?.data) ? sessionsData.data : []);

      const session = sessions.find((s: any) => idsEqual(getObjId(s), id));
      if (session) {
        return NextResponse.json({ success: true, data: session });
      }
    }
  } catch {
    // Ignore workaround errors and return original response
  }

  return response;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  return handleBackendRequest(request, 'PUT', `/api/v1/schedule-sessions/${id}`, { requireAuth: true, body });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handleBackendRequest(request, 'DELETE', `/api/v1/schedule-sessions/${id}`, { requireAuth: true });
}
