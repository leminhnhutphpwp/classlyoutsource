import { NextRequest, NextResponse } from 'next/server';
import { handleBackendRequest, buildBackendUrl } from '@/lib/api-route-helper';

// Payment Statistics API - Forward to PaymentController::statistics
// This is DIFFERENT from /api/reports/statistics which uses ReportsController::statistics
// Backend: /api/v1/payments/statistics (Payment model data: by_method, by_status, etc.)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const backendUrl = buildBackendUrl(request, '/api/v1/payments/statistics');
  return handleBackendRequest(request, 'GET', backendUrl, { requireAuth: true });
}

