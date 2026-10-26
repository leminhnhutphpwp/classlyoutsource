"use client";
import { useRevenueReport } from "@/hooks/use-api";
import dynamic from "next/dynamic";
import { useMemo, useState, memo } from "react";
import { useThemeColors } from "@/hooks/use-theme";
import { formatCurrency } from "@/lib/format-currency";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

type RevenuePoint = { date: string; total: number | string };

const PERIODS = [
  { days: 7, label: "7 ngày" },
  { days: 30, label: "30 ngày" },
  { days: 90, label: "3 tháng" },
] as const;

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function RevenueChartComponent({ className = "" }: { className?: string }) {
  const [period, setPeriod] = useState<number>(30);
  const themeColors = useThemeColors();

  // Doanh thu THẬT theo ngày, tính từ các khoản đã thu (GET /reports/revenue).
  // Trước đây màn này dựng số ngẫu nhiên từ tổng tháng (revenue_this_month / n * Math.random()),
  // nên mỗi lần render ra một con số khác và không khớp bất kỳ báo cáo nào.
  const filters = useMemo(
    () => ({ date_from: isoDaysAgo(period - 1), date_to: isoDaysAgo(0) }),
    [period],
  );
  const { data, loading, error } = useRevenueReport(filters);

  // API chỉ trả về những ngày CÓ phát sinh thu. Bù các ngày trống bằng 0 để
  // trục thời gian liên tục, không bị "nhảy cóc" gây hiểu sai xu hướng.
  const series = useMemo(() => {
    const rows: RevenuePoint[] = Array.isArray(data) ? data : (data?.data ?? []);
    const byDate = new Map<string, number>();
    for (const r of rows) {
      if (r?.date) byDate.set(String(r.date).slice(0, 10), Number(r.total) || 0);
    }

    const points: { x: number; y: number }[] = [];
    for (let i = period - 1; i >= 0; i--) {
      const key = isoDaysAgo(i);
      points.push({ x: new Date(`${key}T00:00:00`).getTime(), y: byDate.get(key) ?? 0 });
    }
    return points;
  }, [data, period]);

  const total = useMemo(() => series.reduce((s, p) => s + p.y, 0), [series]);
  const hasRevenue = total > 0;

  const chartOptions: any = {
    chart: {
      type: "area",
      toolbar: { show: false },
      fontFamily: "inherit",
      zoom: { enabled: false },
      animations: { enabled: false },
    },
    dataLabels: { enabled: false },
    stroke: { curve: "smooth", width: 2 },
    grid: {
      borderColor: "rgba(148,163,184,0.22)",
      strokeDashArray: 3,
      xaxis: { lines: { show: false } },
      padding: { left: 4, right: 12, top: 0 },
    },
    xaxis: {
      // Trục thời gian thật: ApexCharts tự giãn nhãn theo bề rộng, nên không còn
      // cảnh 30 nhãn ngày chồng lên nhau phải xoay chéo mới nhét vừa.
      type: "datetime",
      tickAmount: period <= 7 ? 7 : period <= 30 ? 8 : 6,
      axisBorder: { show: false },
      axisTicks: { show: false },
      tooltip: { enabled: false },
      labels: {
        rotate: 0,
        rotateAlways: false,
        hideOverlappingLabels: true,
        datetimeUTC: false,
        format: "dd/MM",
        style: { colors: "#94a3b8", fontSize: "12px" },
      },
    },
    yaxis: {
      tickAmount: 4,
      labels: {
        // Số đầy đủ, KHÔNG viết tắt ("30.000.000" chứ không phải "30 tr"). Cỡ chữ nhỏ hơn một bậc
        // so với nhãn trục X để nhãn dài vẫn vừa cột trái mà không lấn vào vùng vẽ.
        style: { colors: "#94a3b8", fontSize: "11px" },
        formatter: (val: number) =>
          Math.round(val || 0).toLocaleString("vi-VN"),
      },
    },
    fill: {
      type: "gradient",
      gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.02, stops: [0, 90, 100] },
    },
    colors: [themeColors.primary],
    markers: { size: 0, hover: { size: 5 } },
    tooltip: {
      theme: "dark",
      x: { format: "dd/MM/yyyy" },
      y: { formatter: (val: number) => formatCurrency(val) },
    },
  };

  const header = (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Doanh thu theo thời gian</h3>
        {hasRevenue && (
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Tổng {PERIODS.find((p) => p.days === period)?.label.toLowerCase()} qua:{" "}
            <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(total)}</span>
          </p>
        )}
      </div>
      <div className="inline-flex rounded-lg border border-gray-300 p-0.5 dark:border-gray-600">
        {PERIODS.map((p) => (
          <button
            key={p.days}
            type="button"
            onClick={() => setPeriod(p.days)}
            aria-pressed={period === p.days}
            className={`rounded-md px-3 py-1 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              period === p.days
                ? "bg-primary text-white"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );

  // Không có quyền xem báo cáo nâng cao (gói Free) → ẩn hẳn thay vì báo lỗi đỏ.
  if (error) return null;

  return (
    <div className={`rounded-lg bg-white p-6 dark:bg-gray-800 ${className}`}>
      {header}
      {loading ? (
        <div className="h-[320px] animate-pulse rounded-md bg-gray-100 dark:bg-gray-700/50" />
      ) : hasRevenue ? (
        <Chart
          key={`revenue-chart-${themeColors.primary}-${period}`}
          options={chartOptions}
          series={[{ name: "Doanh thu", data: series }]}
          type="area"
          height={320}
        />
      ) : (
        <div className="flex h-[320px] items-center justify-center text-center text-gray-500 dark:text-gray-400">
          <p>Chưa ghi nhận khoản thu nào trong khoảng thời gian này</p>
        </div>
      )}
    </div>
  );
}

export const RevenueChart = memo(RevenueChartComponent);
