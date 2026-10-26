import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/cookie-utils';
import { VIETQR_BANKS } from '@/lib/vietqr-banks';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Proxy ảnh mã QR VietQR về same-origin.
 *
 * Lý do không fetch thẳng từ client: CSP của app giới hạn `connect-src 'self' <api>`,
 * nên `fetch('https://img.vietqr.io/...')` phía trình duyệt bị chặn và không tải được
 * ảnh về máy. Route này lấy ảnh phía server (không dính CSP) rồi trả về kèm
 * `Content-Disposition: attachment` — trình duyệt vì thế TẢI XUỐNG trực tiếp thay vì
 * điều hướng/mở tab mới.
 *
 * An toàn: không nhận URL tùy ý (tránh SSRF). Chỉ nhận bank code + số tài khoản đã
 * kiểm tra định dạng, rồi tự dựng URL theo whitelist host `img.vietqr.io`.
 */
const IMAGE_HOST = 'https://img.vietqr.io/image';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

function badRequest(message: string): NextResponse {
  return NextResponse.json({ success: false, message }, { status: 400 });
}

/**
 * Xác thực token thật với backend (route này không gọi Laravel để lấy dữ liệu,
 * nên nếu chỉ kiểm tra "cookie có tồn tại" thì cookie giả vẫn qua được).
 */
async function isAuthenticated(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  // Trang nguồn đã được bảo vệ (chỉ owner/manager); giữ nhất quán ở tầng BFF.
  const token = getAuthToken(request);
  if (!token || !(await isAuthenticated(token))) {
    return NextResponse.json(
      { success: false, message: 'Token required. Please login again.' },
      { status: 401 }
    );
  }

  const { searchParams } = request.nextUrl;

  const code = (searchParams.get('code') ?? '').trim().toUpperCase();
  const account = (searchParams.get('account') ?? '').replace(/\D/g, '');
  const amount = (searchParams.get('amount') ?? '').trim();
  const content = (searchParams.get('content') ?? '').trim();

  if (!code || !account) {
    return badRequest('Thiếu mã ngân hàng hoặc số tài khoản.');
  }

  // Chỉ cho phép code ngân hàng nằm trong danh sách chuẩn.
  const isKnownBank = VIETQR_BANKS.some((b) => b.code.toUpperCase() === code);
  if (!isKnownBank) {
    return badRequest('Mã ngân hàng không hợp lệ.');
  }

  // Số tài khoản ngân hàng VN chỉ gồm chữ số, độ dài hợp lý.
  if (account.length < 6 || account.length > 25) {
    return badRequest('Số tài khoản không hợp lệ.');
  }

  const params = new URLSearchParams();
  if (content) params.set('addInfo', content.slice(0, 60));
  if (amount && /^\d{1,15}$/.test(amount)) params.set('amount', amount);

  const queryString = params.toString();
  const imageUrl = `${IMAGE_HOST}/${code}-${account}-compact.png${queryString ? `?${queryString}` : ''}`;

  let upstream: Response;
  try {
    upstream = await fetch(imageUrl, { cache: 'no-store' });
  } catch {
    return NextResponse.json(
      { success: false, message: 'Không tải được mã QR. Vui lòng thử lại sau.' },
      { status: 502 }
    );
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { success: false, message: `Không tải được mã QR (${upstream.status}).` },
      { status: 502 }
    );
  }

  const blob = await upstream.blob();
  const fileName = `qr-${code.toLowerCase()}-${account}.png`;

  return new NextResponse(blob, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'image/png',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': String(blob.size),
      'Cache-Control': 'no-store',
    },
  });
}
