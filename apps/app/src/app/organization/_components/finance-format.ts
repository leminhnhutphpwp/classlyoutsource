// Helpers định dạng dùng chung cho các màn hình tài chính / bảng lương (Wave 5).
import { formatCurrency } from "@/lib/format-currency";

/** Số tiền VND (không âm hoá). "1.000.000 đ". */
export function money(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return formatCurrency(Number.isFinite(n) ? n : 0);
}

/** Số tiền có dấu (lãi/lỗ). Âm → "-1.000.000 đ" và tô đỏ do caller. */
export function signedMoney(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  return safe < 0 ? `-${formatCurrency(Math.abs(safe))}` : formatCurrency(safe);
}

/** Class màu theo dấu (dương xanh, âm đỏ). */
export function amountColor(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  if (n > 0) return "text-green-600 dark:text-green-400";
  if (n < 0) return "text-red-600 dark:text-red-400";
  return "text-gray-900 dark:text-gray-200";
}

export function num(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n.toLocaleString("vi-VN") : "0";
}

/** Phần trăm biên lợi nhuận. "42,5%". */
export function percent(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(n)) return "0%";
  return `${n.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;
}

/** "2026-07" → "07/2026". */
export function monthLabel(month?: string): string {
  if (!month) return "—";
  const [y, m] = month.split("-");
  return m && y ? `${m}/${y}` : month;
}

/** Khoảng thời gian mặc định = tháng hiện tại (YYYY-MM-DD). */
export function currentMonthRange(): { start: string; end: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  return { start: fmt(first), end: fmt(last) };
}
