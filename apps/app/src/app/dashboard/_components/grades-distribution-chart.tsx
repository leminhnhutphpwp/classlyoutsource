"use client";
import { useGrades } from "@/hooks/use-api";
import dynamic from "next/dynamic";
import { useMemo, memo } from "react";
import { useThemeColors } from "@/hooks/use-theme";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { ChartSkeleton } from "@/components/ui/loading";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

function GradesDistributionChartComponent() {
  const { data, loading, error } = useGrades();
  const themeColors = useThemeColors();

  const chartData = useMemo(() => {
    const grades = data || [];
    if (grades.length === 0) return null;

    // Xếp loại do BACKEND quyết định (`grade_label`), vì ngưỡng phụ thuộc thang điểm:
    // IELTS 0–9, TOEIC 0–990, hay thang trường học 0–10/0–100 có mốc hoàn toàn khác nhau.
    // Trước đây màn này tự quy đổi phần trăm rồi áp ngưỡng 90/80/70/60 → một lớp IELTS
    // toàn band 5.5–6.5 (đang đạt mục tiêu) bị xếp gần hết vào "Yếu (<60)".
    const ranges: Record<string, number> = {
      'Xuất sắc': 0,
      'Giỏi': 0,
      'Khá': 0,
      'Trung bình': 0,
      'Cần cải thiện': 0,
    };

    const fallbackLabel = (g: any): string => {
      const pct = g.percentage !== undefined
        ? g.percentage
        : g.max_score > 0
          ? (g.score / g.max_score) * 100
          : 0;
      if (pct >= 90) return 'Xuất sắc';
      if (pct >= 80) return 'Giỏi';
      if (pct >= 70) return 'Khá';
      if (pct >= 60) return 'Trung bình';
      return 'Cần cải thiện';
    };

    grades.forEach((grade: any) => {
      const label = grade.grade_label ?? fallbackLabel(grade);
      if (label in ranges) {
        ranges[label]++;
      } else {
        ranges['Cần cải thiện']++;
      }
    });

    return {
      categories: Object.keys(ranges),
      series: Object.values(ranges),
    };
  }, [data]);

  if (loading) {
    return <ChartSkeleton height={256} showTitle={true} title="Phân bố điểm số" />;
  }

  // Chỉ báo lỗi khi CHƯA CÓ dữ liệu. Lỗi của lần revalidate nền
  // (stale-while-revalidate) không được xoá mất nội dung đang hiển thị.
  if (error && !data) {
    return (
      <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Phân bố điểm số</h3>
        <div className="text-red-600 dark:text-red-400">Lỗi tải điểm số: {error}</div>
      </div>
    );
  }

  if (!chartData || chartData.series.every(v => v === 0)) {
    return (
      <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Phân bố điểm số</h3>
        <div className="flex h-64 items-center justify-center text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2">Không có dữ liệu điểm số</p>
            <p className="text-sm">Chấm điểm để xem thống kê</p>
          </div>
        </div>
      </div>
    );
  }

  const chartOptions: any = {
    chart: {
      type: 'bar',
      toolbar: { show: false },
      fontFamily: 'inherit',
      horizontal: true,
    },
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 4,
        distributed: true,
      },
    },
    dataLabels: {
      enabled: true,
      formatter: (val: number) => val.toString(),
      style: {
        fontSize: '12px',
        fontWeight: 600,
        colors: ['#ffffff'],
      },
    },
    xaxis: {
      categories: chartData.categories,
      labels: {
        style: {
          colors: '#6b7280',
        },
      },
    },
    yaxis: {
      labels: {
        style: {
          colors: '#6b7280',
        },
      },
    },
    colors: [
      themeColors.primary,
      themeColors.primaryLight,
      themeColors.primaryLight,
      themeColors.primaryLight,
      themeColors.primary,
    ],
    tooltip: {
      theme: 'dark',
      y: {
        formatter: (val: number) => `${val} học viên`,
      },
    },
  };

  return (
    <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Phân bố điểm số</h3>
      <Chart
        key={`grades-distribution-chart-${themeColors.primary}`}
        options={chartOptions}
        series={[{ name: 'Số lượng', data: chartData.series }]}
        type="bar"
        height={320}
      />
    </div>
  );
}

export const GradesDistributionChart = memo(GradesDistributionChartComponent);
