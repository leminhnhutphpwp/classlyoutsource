"use client";
import { useAttendance } from "@/hooks/use-api";
import dynamic from "next/dynamic";
import { useMemo, useState, memo } from "react";
import { useThemeColors } from "@/hooks/use-theme";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { ChartSkeleton } from "@/components/ui/loading";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

function AttendanceChartComponent() {
  const { data, loading, error } = useAttendance();
  const [period, setPeriod] = useState<number>(7);
  const themeColors = useThemeColors();

  const chartData = useMemo(() => {
    const attendance = data || [];
    if (attendance.length === 0) return null;

    // Nhóm theo ngày trong period ngày gần nhất
    const days: string[] = [];
    const today = new Date();
    for (let i = period - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      days.push(date.toISOString().split('T')[0]);
    }

    // Đếm số lượng điểm danh theo ngày và trạng thái
    const dailyData: Record<string, { present: number; absent: number; late: number }> = {};

    days.forEach(date => {
      dailyData[date] = { present: 0, absent: 0, late: 0 };
    });

    attendance.forEach((record: any) => {
      const recordDate = new Date(record.date).toISOString().split('T')[0];
      if (dailyData[recordDate]) {
        if (record.status === 'present') {
          dailyData[recordDate].present++;
        } else if (record.status === 'absent') {
          dailyData[recordDate].absent++;
        } else if (record.status === 'late') {
          dailyData[recordDate].late++;
        }
      }
    });

    // Format labels cho chart (ngày/tháng)
    const categories = days.map(date => {
      const d = new Date(date);
      return `${d.getDate()}/${d.getMonth() + 1}`;
    });

    return {
      categories,
      present: days.map(date => dailyData[date]?.present || 0),
      absent: days.map(date => dailyData[date]?.absent || 0),
      late: days.map(date => dailyData[date]?.late || 0),
    };
  }, [data, period]);

  if (loading) {
    return <ChartSkeleton height={256} showTitle={true} title="Xu hướng điểm danh" />;
  }

  // Chỉ báo lỗi khi CHƯA CÓ dữ liệu. Lỗi của lần revalidate nền
  // (stale-while-revalidate) không được xoá mất nội dung đang hiển thị.
  if (error && !data) {
    return (
      <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Thống kê điểm danh 7 ngày</h3>
        <div className="text-red-600 dark:text-red-400">Lỗi tải điểm danh: {error}</div>
      </div>
    );
  }

  if (!chartData) {
    return (
      <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Thống kê điểm danh 7 ngày</h3>
        <div className="flex h-64 items-center justify-center text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2">Không có bản ghi điểm danh</p>
            <p className="text-sm">Bắt đầu điểm danh để xem bản ghi ở đây</p>
          </div>
        </div>
      </div>
    );
  }

  const chartOptions: any = {
    chart: {
      type: 'line',
      toolbar: { show: false },
      fontFamily: 'inherit',
      stacked: false,
    },
    stroke: {
      width: [3, 3, 3],
      curve: 'smooth',
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
    colors: [themeColors.primary, themeColors.primaryDark, themeColors.primaryLight],
    markers: {
      size: 4,
    },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
      labels: {
        colors: '#6b7280',
      },
    },
    tooltip: {
      theme: 'dark',
      shared: true,
      intersect: false,
    },
  };

  return (
    <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Thống kê điểm danh</h3>
        <select
          value={period}
          onChange={(e) => setPeriod(Number(e.target.value))}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        >
          <option value={7}>7 ngày</option>
          <option value={14}>14 ngày</option>
          <option value={30}>30 ngày</option>
        </select>
      </div>
      <Chart
        key={`attendance-chart-${themeColors.primary}`}
        options={chartOptions}
        series={[
          { name: 'Có mặt', data: chartData.present },
          { name: 'Vắng mặt', data: chartData.absent },
          { name: 'Muộn', data: chartData.late },
        ]}
        type="line"
        height={350}
      />
    </div>
  );
}

export const AttendanceChart = memo(AttendanceChartComponent);
