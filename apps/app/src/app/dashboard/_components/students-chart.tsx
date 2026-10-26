"use client";
import { useStudents } from "@/hooks/use-api";
import dynamic from "next/dynamic";
import { useMemo, memo } from "react";
import { useThemeColors } from "@/hooks/use-theme";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { ChartSkeleton } from "@/components/ui/loading";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

function StudentsChartComponent() {
  const { data, loading, error } = useStudents();
  const themeColors = useThemeColors();

  const chartData = useMemo(() => {
    const students = data || [];
    if (students.length === 0) return null;

    // Tính toán theo trạng thái
    const statusCount: Record<string, number> = {};
    students.forEach((student: any) => {
      const status = student.status === 'active' ? 'Đang học' : 'Tạm dừng';
      statusCount[status] = (statusCount[status] || 0) + 1;
    });

    return {
      categories: Object.keys(statusCount),
      series: Object.values(statusCount),
    };
  }, [data]);

  if (loading) {
    return <ChartSkeleton height={256} showTitle={true} title="Phân bố học viên" />;
  }

  // Chỉ báo lỗi khi CHƯA CÓ dữ liệu. Lỗi của lần revalidate nền
  // (stale-while-revalidate) không được xoá mất nội dung đang hiển thị.
  if (error && !data) {
    return (
      <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Phân bố học viên</h3>
        <div className="text-red-600 dark:text-red-400">Lỗi tải học viên: {error}</div>
      </div>
    );
  }

  if (!chartData || chartData.categories.length === 0) {
    return (
      <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Phân bố học viên</h3>
        <div className="flex h-64 items-center justify-center text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2">Không tìm thấy học viên nào</p>
            <p className="text-sm">Thêm học viên đầu tiên để bắt đầu</p>
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
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '55%',
        borderRadius: 4,
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
    stroke: {
      show: true,
      width: 2,
      colors: ['transparent'],
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
    fill: {
      opacity: 1,
      colors: [themeColors.primary, themeColors.primaryLight, themeColors.primaryLight],
    },
    colors: [themeColors.primaryLight, themeColors.primary, themeColors.primaryLight],
    tooltip: {
      theme: 'dark',
      y: {
        formatter: (val: number) => `${val} học viên`,
      },
    },
  };

  return (
    <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Phân bố học viên</h3>
      <Chart
        key={`students-chart-${themeColors.primary}`}
        options={chartOptions}
        series={[{ name: 'Số lượng', data: chartData.series }]}
        type="bar"
        height={320}
      />
    </div>
  );
}

export const StudentsChart = memo(StudentsChartComponent);
