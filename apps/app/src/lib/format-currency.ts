/**
 * Format currency utility
 * Chuẩn hóa format tiền tệ trong toàn bộ hệ thống
 */

/**
 * Format số tiền thành chuỗi với ký hiệu ₫
 * @param amount - Số tiền cần format
 * @param options - Tùy chọn format
 * @returns Chuỗi đã format (ví dụ: "1.000.000 ₫")
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  options?: {
    showSymbol?: boolean; // Mặc định true
    locale?: string; // Mặc định 'vi-VN'
  }
): string {
  if (amount === null || amount === undefined || amount === '') {
    return '0 đ';
  }

  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(numAmount)) {
    return '0 đ';
  }

  const { showSymbol = true } = options || {};

  // Sử dụng locale vi-VN để có dấu chấm phân cách hàng nghìn chuẩn xác
  const formatted = numAmount.toLocaleString('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  return showSymbol ? `${formatted} đ` : formatted;
}

/*
 * KHÔNG viết tắt số tiền (không "229,8 tr") và KHÔNG viết tắt đơn vị.
 *
 * Đã từng thêm formatCurrencyCompact() để chống tràn ở thẻ KPI, nhưng đó là giải pháp sai cho
 * bối cảnh này: người dùng là kế toán và chủ trung tâm — họ cần con số CHÍNH XÁC, không phải
 * con số ước lượng. Cách chống tràn đúng là tự giảm cỡ chữ theo độ dài chuỗi,
 * xem components/Common/Money.tsx.
 */

/**
 * Format số tiền với Intl.NumberFormat (chuẩn hơn)
 * @param amount - Số tiền cần format
 * @returns Chuỗi đã format (ví dụ: "1.000.000 đ")
 */
export function formatCurrencyIntl(
  amount: number | string | null | undefined
): string {
  if (amount === null || amount === undefined || amount === '') {
    return '0 đ';
  }

  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(numAmount)) {
    return '0 đ';
  }

  const formatted = new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numAmount);

  return `${formatted} đ`;
}

/**
 * Format số tiền thành chuỗi với dấu chấm làm thousand separator (dùng cho input)
 * Ví dụ: "500000" -> "500.000"
 * 
 * @param value - Giá trị cần format (string hoặc number)
 * @returns Chuỗi đã format với dấu chấm
 */
export function formatAmount(value: string | number): string {
  if (!value) return "";
  const numericValue = value.toString().replace(/\D/g, "");
  if (!numericValue) return "";
  const num = parseInt(numericValue, 10);
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Parse chuỗi số tiền thành number (loại bỏ dấu chấm và các ký tự không phải số)
 * Ví dụ: "500.000" -> 500000
 * 
 * @param value - Chuỗi cần parse
 * @returns Số tiền dạng number, hoặc null nếu không hợp lệ
 */
export function parseAmount(value: string): number | null {
  if (!value) return null;
  const numericValue = value.toString().replace(/\D/g, "");
  return numericValue ? parseInt(numericValue, 10) : null;
}

