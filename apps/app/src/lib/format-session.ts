import { getObjId } from "@/lib/id-utils";

/**
 * Format session title into a human-readable, concise string
 */
export function formatSessionTitle(session: any): string {
    if (!session) return 'N/A';

    // 1. Nếu buổi học có tên riêng (được custom), dùng nó.
    // Loại bỏ các tên mặc định generic.
    if (session.name && session.name !== 'Buổi học' && session.name !== 'Session') {
        return session.name;
    }

    // Chuẩn bị ngày tháng
    let dateStr = '';
    if (session.session_date) {
        const date = new Date(session.session_date);
        // Format ngắn gọn: dd/MM
        dateStr = date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    }

    // 2. Ưu tiên hiển thị Tên Lớp để biết buổi học thuộc về lớp nào
    const className = session.class?.name || session.schedule?.class?.name;

    if (className) {
        return dateStr ? `${className} - ${dateStr}` : className;
    }

    // 3. Nếu không có tên lớp, thử tên Lịch (nếu lịch có tên riêng như "Lịch học thêm Toán")
    // Tránh hiển thị tên lịch nếu nó chỉ là chuỗi recurrence mặc định
    const scheduleName = session.schedule?.name || session.schedule?.title;
    if (scheduleName) {
        return dateStr ? `${scheduleName} - ${dateStr}` : scheduleName;
    }

    // 4. Fallback: Chỉ hiển thị ngày
    if (dateStr) {
        return `Buổi học ngày ${dateStr}`;
    }

    // 5. Cuối cùng mới dùng ID
    return `Buổi học #${getObjId(session) || 'N/A'}`;
}
