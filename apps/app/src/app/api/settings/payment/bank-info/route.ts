import { NextRequest } from 'next/server';
import { handleBackendRequest } from '@/lib/api-route-helper';

export async function GET(request: NextRequest) {
  return handleBackendRequest(request, 'GET', '/api/v1/settings/payment/bank-info', { requireAuth: true });
}

export async function PUT(request: NextRequest) {
  let body;
  try {
    // The backend expects JSON; parse defensively so malformed payloads return 400, not 500.
    const text = await request.text();
    if (text) {
      body = JSON.parse(text);
    } else {
      body = {};
    }
  } catch {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Dữ liệu JSON không hợp lệ',
        code: 'INVALID_JSON',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return handleBackendRequest(request, 'PUT', '/api/v1/settings/payment/bank-info', { requireAuth: true, body });
}
