"use client";
import { useAssignments } from "@/hooks/use-api";
import dynamic from "next/dynamic";
import { useMemo, memo } from "react";
import { useThemeColors } from "@/hooks/use-theme";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { ChartSkeleton } from "@/components/ui/loading";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

function AssignmentsCompletionChartComponent() {
  const { data, loading, error } = useAssignments();
  const themeColors = useThemeColors();

  const chartData = useMemo(() => {
    const assignments = data || [];
    if (assignments.length === 0) return null;

    let gradedSubmissions = 0;
    let pendingSubmissions = 0;
    let notSubmitted = 0;

    assignments.forEach((assignment: any) => {
      const submissionsCount = assignment.submissions_count || 0;
      const gradedCount = assignment.graded_submissions_count || 0;
      const pendingCount = assignment.pending_submissions_count || 0;

      gradedSubmissions += gradedCount;
      pendingSubmissions += pendingCount;

      // Ước tính số chưa nộp (giả sử mỗi assignment có khoảng 20 học viên)
      const estimatedStudents = 20; // Có thể lấy từ class data
      notSubmitted += Math.max(0, estimatedStudents - submissionsCount);
    });

    return {
      categories: ['Đã chấm', 'Đang chờ', 'Chưa nộp'],
      series: [gradedSubmissions, pendingSubmissions, notSubmitted],
    };
  }, [data]);

  if (loading) {
    return <ChartSkeleton height={256} showTitle={true} title="Hoàn thành bài tập" />;
  }

  // Chỉ báo lỗi khi CHƯA CÓ dữ liệu. Lỗi của lần revalidate nền
  // (stale-while-revalidate) không được xoá mất nội dung đang hiển thị.
  if (error && !data) {
    return (
      <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tỷ lệ hoàn thành bài tập</h3>
        <div className="text-red-600 dark:text-red-400">Lỗi tải bài tập: {error}</div>
      </div>
    );
  }

  if (!chartData || chartData.series.every(v => v === 0)) {
    return (
      <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tỷ lệ hoàn thành bài tập</h3>
        <div className="flex h-64 items-center justify-center text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2">Không có dữ liệu bài tập</p>
            <p className="text-sm">Tạo bài tập để xem thống kê</p>
          </div>
        </div>
      </div>
    );
  }

  const chartOptions: any = {
    chart: {
      type: 'pie',
      toolbar: { show: false },
      fontFamily: 'inherit',
    },
    labels: chartData.categories,
    colors: [themeColors.primary, themeColors.primaryLight, themeColors.primary],
    legend: {
      position: 'bottom',
      labels: {
        colors: '#6b7280',
      },
    },
    dataLabels: {
      enabled: false,
    },
    tooltip: {
      theme: 'dark',
      y: {
        formatter: function (val: number, opts: any) {
          try {
            if (!opts || !opts.w || !opts.w.globals) {
              return `${val}`;
            }
            const globals = opts.w.globals;
            const seriesTotals = globals.seriesTotals || [];
            const total = seriesTotals.reduce((a: number, b: number) => a + b, 0);
            const percentage = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
            const labels = globals.labels || [];
            const label = labels[opts.seriesIndex] || 'N/A';
            return `${label}: ${val} (${percentage}%)`;
          } catch {
            return `${val}`;
          }
        }
      }
    },
  };

  return (
    <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tỷ lệ hoàn thành bài tập</h3>
      <Chart
        key={`assignments-completion-chart-${themeColors.primary}`}
        options={chartOptions}
        series={chartData.series}
        type="pie"
        height={320}
      />
    </div>
  );
}

export const AssignmentsCompletionChart = memo(AssignmentsCompletionChartComponent);
