import { NextRequest } from "next/server";
import { handleBackendRequest } from "@/lib/api-route-helper";

export async function POST(request: NextRequest) {
  const body = await request.json();
  return handleBackendRequest(request, 'POST', '/api/v1/payments/decode-token', {
    requireAuth: false, // Usually public if from a link, but check doc. Doc doesn't say. safely assume public or auth. Let's assume public for decode.
    body
  });
}
