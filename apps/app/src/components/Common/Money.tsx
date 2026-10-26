"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format-currency";

/**
 * Hiển thị số tiền trong ô có bề rộng cố định — LUÔN giữ số đầy đủ và đơn vị đầy đủ.
 *
 * BỐI CẢNH: tiền VND thường 9–12 chữ số ("229.800.000 đ" = 13 ký tự). Thẻ số liệu (KPI) có bề rộng
 * cố định nên trước đây dùng `truncate`, và chuỗi bị cắt thành "229.800.00…". Cắt chữ là cách xử lý
 * cho VĂN BẢN dài, KHÔNG dùng được cho con số: mất chữ số cuối là sai hoàn toàn về độ lớn, và người
 * đọc không có cách nào biết mình đang thiếu bao nhiêu.
 *
 * CÁCH GIẢI QUYẾT: không viết tắt (không "229,8 tr"), không rút gọn đơn vị — thay vào đó TỰ GIẢM
 * CỠ CHỮ theo độ dài chuỗi. Số càng dài chữ càng nhỏ, nên luôn vừa ô mà vẫn đọc được trọn vẹn
 * từng chữ số. Kế toán và chủ trung tâm cần con số chính xác, không phải con số ước lượng.
 *
 * @example
 *   <Money amount={850000} />       → "850.000 đ"      (cỡ lớn nhất)
 *   <Money amount={229800000} />    → "229.800.000 đ"  (tự giảm một bậc)
 *   <Money amount={12000000000} />  → "12.000.000.000 đ" (giảm thêm bậc nữa)
 */

/**
 * Thang cỡ chữ cho thẻ KPI, chọn theo ĐỘ DÀI chuỗi đã format.
 * Vẫn giữ responsive (mobile nhỏ hơn desktop) như thiết kế gốc của các thẻ.
 *
 * Mốc độ dài tính theo chuỗi thật:
 *   "850.000 đ"        =  9  → bậc 0
 *   "12.500.000 đ"     = 12  → bậc 1
 *   "229.800.000 đ"    = 13  → bậc 1
 *   "1.250.000.000 đ"  = 15  → bậc 2
 *   "12.000.000.000 đ" = 16  → bậc 3
 */
const TILE_SIZES = [
  "text-base sm:text-xl xl:text-2xl",
  "text-sm sm:text-lg xl:text-xl",
  "text-sm sm:text-base xl:text-lg",
  "text-xs sm:text-sm xl:text-base",
] as const;

function tileSizeFor(length: number): string {
  if (length <= 10) return TILE_SIZES[0];
  if (length <= 13) return TILE_SIZES[1];
  if (length <= 15) return TILE_SIZES[2];
  return TILE_SIZES[3];
}

type MoneyProps = {
  amount: number | string | null | undefined;
  /**
   * `tile` (mặc định): tự chọn cỡ chữ theo độ dài — dùng cho thẻ KPI bề rộng cố định.
   * `inline`: không đụng tới cỡ chữ, phần tử cha tự quyết định.
   */
  size?: "tile" | "inline";
  className?: string;
  /** Bỏ " đ" khi đơn vị đã ghi ở nhãn cột/tiêu đề. */
  showSymbol?: boolean;
};

function MoneyComponent({
  amount,
  size = "tile",
  className,
  showSymbol = true,
}: MoneyProps) {
  const text = formatCurrency(amount, { showSymbol });

  return (
    <span
      className={cn(
        // tabular-nums: các chữ số cùng bề rộng → nhiều thẻ xếp cạnh nhau thẳng hàng.
        // whitespace-nowrap: không bao giờ ngắt dòng giữa một con số.
        "tabular-nums whitespace-nowrap",
        size === "tile" && tileSizeFor(text.length),
        className,
      )}
      // Vẫn giữ tooltip: hữu ích khi cửa sổ hẹp bất thường hoặc người dùng phóng to chữ hệ thống.
      title={text}
    >
      {text}
    </span>
  );
}

export const Money = memo(MoneyComponent);
export default Money;
