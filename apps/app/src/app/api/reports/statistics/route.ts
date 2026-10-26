import { NextRequest } from 'next/server';
import { handleBackendRequest, buildBackendUrl } from '@/lib/api-route-helper';

// Reports Statistics API - Forward to ReportsController::statistics
// This is DIFFERENT from /api/payments/statistics which uses PaymentController::statistics
// Backend: /api/v1/reports/statistics (Invoice & Addon data: revenue, invoices, addons stats)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const url = buildBackendUrl(request, '/api/v1/reports/statistics');
  return handleBackendRequest(request, 'GET', url, { requireAuth: true });
}

