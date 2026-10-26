import { NextRequest, NextResponse } from 'next/server';
import { handleBackendRequest } from '@/lib/api-route-helper';
import { clearAuthCookies } from '@/lib/cookie-utils';

export async function POST(request: NextRequest) {
  // Route này là ĐƯỜNG THOÁT duy nhất khỏi một phiên hỏng: cookie đặt HttpOnly nên
  // client không tự xoá được. Vì vậy nó phải xoá cookie trong MỌI tình huống, kể cả
  // khi Laravel trả lỗi hoặc không gọi tới được. Nếu để cookie hỏng nằm lại thì
  // middleware.ts vẫn coi là đã đăng nhập (nó chỉ kiểm tra cookie tồn tại) và người
  // dùng kẹt trong vòng lặp chuyển hướng, không cách nào tự thoát.
  let payload: unknown = { success: true, message: 'Đã đăng xuất.' };

  try {
    const backendResponse = await handleBackendRequest(request, 'POST', '/api/v1/auth/logout', {
      requireAuth: true,
    });

    if (backendResponse.ok) {
      payload = await backendResponse.json();
    }
  } catch {
    // Backend từ chối hoặc không gọi tới được — bỏ qua, phần xoá cookie bên dưới mới
    // là việc bắt buộc phải xong.
  }

  // LUÔN trả 200 khi đã xoá được cookie, kể cả lúc backend trả 401 (token hết hạn là
  // lý do phổ biến nhất khiến người ta bấm đăng xuất). Với phía gọi thì thao tác đã
  // hoàn tất: phiên trên trình duyệt chấm dứt. Trả 401 còn gây hại — api-client tự
  // động refresh khi gặp 401, nên một lần đăng xuất sẽ khởi động lại đúng chuỗi
  // request mà nó vừa dừng. Token cũ phía server tự hết hạn theo JWT_TTL.
  const response = NextResponse.json(payload, { status: 200 });
  clearAuthCookies(response);

  return response;
}
