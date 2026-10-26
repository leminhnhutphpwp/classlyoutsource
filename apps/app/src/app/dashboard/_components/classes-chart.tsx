"use client";
import { useClasses } from "@/hooks/use-api";
import dynamic from "next/dynamic";
import { useMemo, memo } from "react";
import { useThemeColors } from "@/hooks/use-theme";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { ChartSkeleton } from "@/components/ui/loading";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

function ClassesChartComponent() {
  const { data, loading, error } = useClasses();
  const themeColors = useThemeColors();

  const chartData = useMemo(() => {
    const classes = data || [];
    if (classes.length === 0) return null;

    // Tính toán theo trạng thái
    const statusCount: Record<string, number> = {};
    classes.forEach((classItem: any) => {
      const status = classItem.status === 'active' ? 'Đang dạy' : 'Tạm dừng';
      statusCount[status] = (statusCount[status] || 0) + 1;
    });

    return {
      categories: Object.keys(statusCount),
      series: Object.values(statusCount),
    };
  }, [data]);

  if (loading) {
    return <ChartSkeleton height={256} showTitle={true} title="Phân bố lớp học" />;
  }

  // Chỉ báo lỗi khi CHƯA CÓ dữ liệu. Lỗi của lần revalidate nền
  // (stale-while-revalidate) không được xoá mất nội dung đang hiển thị.
  if (error && !data) {
    return (
      <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Phân bố lớp học</h3>
        <div className="text-red-600 dark:text-red-400">Lỗi tải lớp học: {error}</div>
      </div>
    );
  }

  if (!chartData || chartData.categories.length === 0) {
    return (
      <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Phân bố lớp học</h3>
        <div className="flex h-64 items-center justify-center text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2">Không tìm thấy lớp học nào</p>
            <p className="text-sm">Tạo lớp học đầu tiên để bắt đầu</p>
          </div>
        </div>
      </div>
    );
  }

  const chartOptions: any = {
    chart: {
      type: 'donut',
      toolbar: { show: false },
      fontFamily: 'inherit',
    },
    labels: chartData.categories,
    colors: [themeColors.primary, "#6b7280", themeColors.primaryLight],
    legend: {
      position: 'bottom',
      labels: {
        colors: ['#6b7280', '#6b7280'],
      },
    },
    dataLabels: {
      enabled: false,
    },
    plotOptions: {
      pie: {
        donut: {
          size: '65%',
          labels: {
            show: true,
            name: { show: true, fontSize: '14px', fontWeight: 600 },
            value: { show: true, fontSize: '20px', fontWeight: 700 },
            total: {
              show: true,
              label: 'Tổng lớp học',
              formatter: () => {
                const total = chartData.series.reduce((a, b) => a + b, 0);
                return total.toString();
              },
            },
          },
        },
      },
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
          } catch (_error) {
            return `${val}`;
          }
        }
      }
    },
  };

  return (
    <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Phân bố lớp học</h3>
      <Chart
        key={`classes-chart-${themeColors.primary}`}
        options={chartOptions}
        series={chartData.series}
        type="donut"
        height={320}
      />
    </div>
  );
}

export const ClassesChart = memo(ClassesChartComponent);
