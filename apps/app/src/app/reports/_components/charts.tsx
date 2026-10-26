"use client";
import { useMemo } from "react";
import dynamic from "next/dynamic";
import {
  ChartBarIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  DocumentTextIcon,
  AcademicCapIcon,
  CreditCardIcon,
  ClipboardDocumentListIcon,
} from "@heroicons/react/24/outline";
import { useThemeColors } from "@/hooks/use-theme";
import { formatCurrency } from "@/lib/format-currency";
import { ChartSkeleton } from "@/components/ui/loading";
import { GRADE_COLORS, GRADE_DEFAULT_COLOR } from "./report-constants";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

// Revenue Chart Component
export function RevenueChartComponent({
  revenueData,
  paymentsReportData,
  loading
}: {
  revenueData: any[] | null | undefined;
  paymentsReportData: any;
  loading: boolean;
}) {
  const themeColors = useThemeColors();
  const chartData = useMemo(() => {
    // Ưu tiên sử dụng paymentsReportData.trend vì có dữ liệu thực tế
    const trendData = paymentsReportData?.trend || [];

    if (trendData.length === 0 && revenueData && revenueData.length > 0) {
      // Fallback về revenueData nếu có
      return revenueData.map((item: any) => ({
        date: item.date || item.date,
        total: item.total || item.amount || 0,
      }));
    }

    return trendData;
  }, [revenueData, paymentsReportData]);

  if (loading) {
    return <ChartSkeleton height={320} showTitle={true} />;
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Biểu đồ doanh thu theo tháng
        </h3>
        <div className="h-80 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-center">
            <ChartBarIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Không có dữ liệu để hiển thị biểu đồ</p>
          </div>
        </div>
      </div>
    );
  }

  // Format dữ liệu cho biểu đồ
  const categories = chartData.map((item: any) => {
    const date = new Date(item.date);
    return `${date.getDate()}/${date.getMonth() + 1}`;
  });

  const series = chartData.map((item: any) => item.total || 0);

  const chartOptions: any = {
    chart: {
      type: 'area',
      toolbar: { show: false },
      fontFamily: 'inherit',
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      curve: 'smooth',
      width: 3,
    },
    xaxis: {
      categories: categories,
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
        formatter: (val: number) => formatCurrency(val, { showSymbol: false }),
      },
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.7,
        opacityTo: 0.3,
        stops: [0, 90, 100],
      },
    },
    colors: [themeColors.primary],
    tooltip: {
      theme: 'dark',
      y: {
        formatter: (val: number) => formatCurrency(val),
      },
    },
  };

  return (
    <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Biểu đồ doanh thu theo tháng
      </h3>
      <Chart
        key={`revenue-chart-${themeColors.primary}`}
        options={chartOptions}
        series={[{ name: 'Doanh thu', data: series }]}
        type="area"
        height={320}
      />
    </div>
  );
}

// Student Growth Chart Component
export function StudentGrowthChartComponent({
  dashboardData,
  loading
}: {
  dashboardData: any;
  loading: boolean;
}) {
  const reportData = dashboardData?.by_status;
  const theme = useThemeColors();

  const chartData = useMemo(() => {
    if (!reportData || reportData.length === 0) return null;

    const statusLabels: Record<string, string> = {
      'active': 'Đang học',
      'inactive': 'Đã nghỉ',
      'graduated': 'Đã tốt nghiệp',
    };

    const statusCount: Record<string, number> = {};
    reportData.forEach((item: any) => {
      const statusLabel = statusLabels[item.status] || item.status || 'Khác';
      statusCount[statusLabel] = (statusCount[statusLabel] || 0) + (item.count || 0);
    });

    return {
      categories: Object.keys(statusCount),
      series: Object.values(statusCount),
    };
  }, [reportData]);

  if (loading) {
    return <ChartSkeleton height={256} showTitle={true} />;
  }

  if (!chartData || chartData.categories.length === 0) {
    return (
      <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Tăng trưởng học viên
        </h3>
        <div className="h-64 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-center">
            <UserGroupIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500 dark:text-gray-400">Không có dữ liệu</p>
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
      colors: [theme.primary, theme.primaryLight, '#94A3B8'],
    },
    colors: [theme.primary, theme.primaryLight, '#94A3B8'],
    tooltip: {
      theme: 'dark',
      y: {
        formatter: (val: number) => `${val} học viên`,
      },
    },
  };

  return (
    <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
      <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Tăng trưởng học viên
      </h3>
      <Chart
        options={chartOptions}
        series={[{ name: 'Số lượng', data: chartData.series }]}
        type="bar"
        height={256}
      />
    </div>
  );
}

// Class Performance Chart Component
export function ClassPerformanceChartComponent({
  dashboardData,
  loading
}: {
  dashboardData: any;
  loading: boolean;
}) {
  const reportData = dashboardData?.by_status;

  const chartData = useMemo(() => {
    if (!reportData || reportData.length === 0) return null;

    const statusLabels: Record<string, string> = {
      'active': 'Đang dạy',
      'inactive': 'Tạm dừng',
      'completed': 'Đã hoàn thành',
    };

    const statusCount: Record<string, number> = {};
    reportData.forEach((item: any) => {
      const statusLabel = statusLabels[item.status] || item.status || 'Khác';
      statusCount[statusLabel] = (statusCount[statusLabel] || 0) + (item.count || 0);
    });

    return {
      categories: Object.keys(statusCount),
      series: Object.values(statusCount),
    };
  }, [reportData]);

  if (loading) {
    return <ChartSkeleton height={256} showTitle={true} title="Hiệu suất lớp học" />;
  }

  if (!chartData || chartData.categories.length === 0) {
    return (
      <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Hiệu suất lớp học
        </h3>
        <div className="h-64 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-center">
            <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500 dark:text-gray-400">Không có dữ liệu</p>
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
    // Dùng trực tiếp CSS variables để luôn khớp với theme hiện tại
    colors: ['var(--color-primary)', '#6b7280', 'var(--color-primary-light)'],
    legend: {
      position: 'bottom',
      labels: {
        colors: ['#6b7280', '#6b7280'],
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
  };

  return (
    <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
      <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Hiệu suất lớp học
      </h3>
      <Chart
        options={chartOptions}
        series={chartData.series}
        type="donut"
        height={256}
      />
    </div>
  );
}

// Attendance by Class Chart Component
export function AttendanceByClassChart({
  data,
  loading
}: {
  data: any[];
  loading: boolean;
}) {
  const theme = useThemeColors();
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null;

    // Truncate tên lớp dài để tránh đè lên nhau
    const categories = data.map((item: any) => {
      const className = item.class_name || 'Không tên';
      return className.length > 20 ? `${className.substring(0, 20)}...` : className;
    });
    const series = data.map((item: any) => item.attendance_rate || 0);

    return { categories, series, fullNames: data.map((item: any) => item.class_name || 'Không tên') };
  }, [data]);

  if (loading) {
    return (
      <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Phân bố theo lớp học
        </h3>
        <div className="h-80 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-lg animate-pulse">
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div className="h-16 w-16 rounded-lg bg-gray-200 dark:bg-gray-600 mx-auto mb-4" />
              <div className="h-4 w-48 rounded bg-gray-200 dark:bg-gray-600 mx-auto" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!chartData || chartData.categories.length === 0) {
    return (
      <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Phân bố theo lớp học
        </h3>
        <div className="h-80 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-center">
            <AcademicCapIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Không có dữ liệu</p>
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
        columnWidth: '60%',
        borderRadius: 4,
        dataLabels: {
          position: 'top',
        },
      },
    },
    dataLabels: {
      enabled: true,
      formatter: (val: number) => `${Math.round(val)}%`,
      offsetY: -20,
      style: {
        fontSize: '12px',
        colors: ['#6b7280'],
      },
    },
    xaxis: {
      categories: chartData.categories,
      labels: {
        style: {
          colors: '#6b7280',
          fontSize: '11px',
        },
        rotate: -45,
        rotateAlways: true,
        maxHeight: 80,
        offsetY: 10,
      },
    },
    yaxis: {
      labels: {
        style: {
          colors: '#6b7280',
        },
        formatter: (val: number) => `${Math.round(val)}%`,
      },
      max: 100,
    },
    fill: {
      opacity: 1,
      colors: [theme.primary],
    },
    colors: [theme.primary],
    tooltip: {
      theme: 'dark',
      y: {
        formatter: (val: number) => `${Math.round(val)}%`,
      },
    },
  };

  return (
    <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Phân bố theo lớp học
      </h3>
      <Chart
        options={chartOptions}
        series={[{ name: 'Tỷ lệ đi học', data: chartData.series }]}
        type="bar"
        height={320}
      />
    </div>
  );
}

// Attendance Trend Chart Component
export function AttendanceTrendChart({
  data,
  loading
}: {
  data: any[];
  loading: boolean;
}) {
  const theme = useThemeColors();
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null;

    const categories = data.map((item: any) => {
      const date = new Date(item.date);
      return `${date.getDate()}/${date.getMonth() + 1}`;
    });
    const series = data.map((item: any) => item.attendance_rate || 0);

    return { categories, series };
  }, [data]);

  if (loading) {
    return <ChartSkeleton height={320} showTitle={true} title="Xu hướng điểm danh" />;
  }

  if (!chartData || chartData.categories.length === 0) {
    return (
      <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Xu hướng điểm danh
        </h3>
        <div className="h-80 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-center">
            <ChartBarIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Không có dữ liệu</p>
          </div>
        </div>
      </div>
    );
  }

  const chartOptions: any = {
    chart: {
      type: 'area',
      toolbar: { show: false },
      fontFamily: 'inherit',
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      curve: 'smooth',
      width: 3,
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
        formatter: (val: number) => `${Math.round(val)}%`,
      },
      max: 100,
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.7,
        opacityTo: 0.3,
        stops: [0, 90, 100],
      },
    },
    colors: [theme.primary],
    tooltip: {
      theme: 'dark',
      y: {
        formatter: (val: number) => `${Math.round(val)}%`,
      },
    },
  };

  return (
    <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Xu hướng điểm danh
      </h3>
      <Chart
        options={chartOptions}
        series={[{ name: 'Tỷ lệ đi học', data: chartData.series }]}
        type="area"
        height={320}
      />
    </div>
  );
}

// Payment Methods Chart Component
export function PaymentMethodsChart({
  data,
  loading
}: {
  data: any[];
  loading: boolean;
}) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null;

    const methodLabels: Record<string, string> = {
      'bank': 'Chuyển khoản',
      'bank_transfer': 'Chuyển khoản',
      'cash': 'Tiền mặt',
      'other': 'Khác',
    };

    const labels = data.map((item: any) =>
      methodLabels[item.payment_method] || item.payment_method || 'Không xác định'
    );
    const series = data.map((item: any) => item.count || 0);

    return { labels, series };
  }, [data]);

  if (loading) {
    return <ChartSkeleton height={320} showTitle={true} title="Phương thức thanh toán" />;
  }

  if (!chartData || chartData.labels.length === 0) {
    return (
      <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Phương thức thanh toán
        </h3>
        <div className="h-80 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-center">
            <CreditCardIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Không có dữ liệu phương thức thanh toán</p>
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
    labels: chartData.labels,
    // Dùng CSS variables để bám theo theme (primary / primary-light)
    colors: [
      'var(--color-primary-light)',
      'var(--color-primary)',
      'var(--color-primary-light)',
      'var(--color-primary-light)',
      'var(--color-primary)',
      '#6b7280',
    ],
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
              label: 'Tổng',
              fontSize: '14px',
              fontWeight: 600,
              formatter: () => {
                const total = chartData.series.reduce((sum, val) => sum + val, 0);
                return total.toString();
              },
            },
          },
        },
      },
    },
  };

  return (
    <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Phương thức thanh toán
      </h3>
      <Chart
        options={chartOptions}
        series={chartData.series}
        type="donut"
        height={320}
      />
    </div>
  );
}

// Students by Status Chart Component
export function StudentsByStatusChart({
  data,
  loading
}: {
  data: any[];
  loading: boolean;
}) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null;

    const statusLabels: Record<string, string> = {
      'active': 'Đang học',
      'inactive': 'Đã nghỉ',
      'graduated': 'Đã tốt nghiệp',
    };

    const labels = data.map((item: any) =>
      statusLabels[item.status] || item.status || 'Khác'
    );
    const series = data.map((item: any) => item.count || 0);

    return { labels, series };
  }, [data]);

  if (loading) {
    return <ChartSkeleton height={320} showTitle={true} title="Phân bố theo trạng thái" />;
  }

  if (!chartData || chartData.labels.length === 0) {
    return (
      <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Phân bố theo trạng thái
        </h3>
        <div className="h-80 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-center">
            <UserGroupIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Không có dữ liệu</p>
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
    labels: chartData.labels,
    // Dùng CSS variables để luôn theo theme hiện tại (classly-blue, emerald, ...)
    colors: ['var(--color-primary)', '#6b7280', 'var(--color-primary-light)'],
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
              label: 'Tổng',
              fontSize: '14px',
              fontWeight: 600,
              formatter: () => {
                const total = chartData.series.reduce((sum, val) => sum + val, 0);
                return total.toString();
              },
            },
          },
        },
      },
    },
  };

  return (
    <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Phân bố theo trạng thái
      </h3>
      <Chart
        options={chartOptions}
        series={chartData.series}
        type="donut"
        height={320}
      />
    </div>
  );
}

// Students by Class Chart Component
export function StudentsByClassChart({
  data,
  loading
}: {
  data: any[];
  loading: boolean;
}) {
  const theme = useThemeColors();
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null;

    // Truncate tên lớp dài để tránh đè lên nhau
    const categories = data.map((item: any) => {
      const className = item.class_name || 'Không tên';
      return className.length > 20 ? `${className.substring(0, 20)}...` : className;
    });
    const series = data.map((item: any) => item.student_count || 0);

    return { categories, series, fullNames: data.map((item: any) => item.class_name || 'Không tên') };
  }, [data]);

  if (loading) {
    return <ChartSkeleton height={320} showTitle={true} title="Phân bố theo lớp học" />;
  }

  if (!chartData || chartData.categories.length === 0) {
    return (
      <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Phân bố theo lớp học
        </h3>
        <div className="h-80 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-center">
            <AcademicCapIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Không có dữ liệu</p>
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
        columnWidth: '60%',
        borderRadius: 4,
        dataLabels: {
          position: 'top',
        },
      },
    },
    dataLabels: {
      enabled: true,
      formatter: (val: number) => val.toString(),
      offsetY: -20,
      style: {
        fontSize: '12px',
        colors: ['#6b7280'],
      },
    },
    xaxis: {
      categories: chartData.categories,
      labels: {
        style: {
          colors: '#6b7280',
          fontSize: '11px',
        },
        rotate: -45,
        rotateAlways: true,
        maxHeight: 80,
        offsetY: 10,
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
      colors: [theme.primary],
    },
    colors: [theme.primary],
    tooltip: {
      theme: 'dark',
      y: {
        formatter: (val: number) => `${val} học viên`,
      },
    },
  };

  return (
    <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Phân bố theo lớp học
      </h3>
      <Chart
        options={chartOptions}
        series={[{ name: 'Số học viên', data: chartData.series }]}
        type="bar"
        height={320}
      />
    </div>
  );
}

// Students Growth Chart Component
export function StudentsGrowthChart({
  data,
  loading
}: {
  data: any[];
  loading: boolean;
}) {
  const theme = useThemeColors();
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null;

    const categories = data.map((item: any) => item.month || '');
    const series = data.map((item: any) => item.count || 0);

    return { categories, series };
  }, [data]);

  if (loading) {
    return <ChartSkeleton height={320} showTitle={true} title="Xu hướng tăng trưởng học viên" />;
  }

  if (!chartData || chartData.categories.length === 0) {
    return null;
  }

  const chartOptions: any = {
    chart: {
      type: 'area',
      toolbar: { show: false },
      fontFamily: 'inherit',
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      curve: 'smooth',
      width: 3,
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
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.7,
        opacityTo: 0.3,
        stops: [0, 90, 100],
      },
    },
    colors: [theme.primary],
    tooltip: {
      theme: 'dark',
      y: {
        formatter: (val: number) => `${val} học viên`,
      },
    },
  };

  return (
    <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Xu hướng tăng trưởng học viên
      </h3>
      <Chart
        options={chartOptions}
        series={[{ name: 'Số học viên mới', data: chartData.series }]}
        type="area"
        height={320}
      />
    </div>
  );
}

// Classes by Status Chart Component
export function ClassesByStatusChart({
  data,
  loading
}: {
  data: any;
  loading: boolean;
}) {
  const chartData = useMemo(() => {
    if (!data) return null;

    const statusLabels: Record<string, string> = {
      'active': 'Đang dạy',
      'inactive': 'Tạm dừng',
      'completed': 'Đã hoàn thành',
    };

    let labels: string[] = [];
    let series: number[] = [];

    if (Array.isArray(data)) {
      labels = data.map((item: any) =>
        statusLabels[item.status] || item.status || 'Khác'
      );
      series = data.map((item: any) => item.count || 0);
    } else if (typeof data === 'object') {
      labels = Object.keys(data).map(status =>
        statusLabels[status] || status || 'Khác'
      );
      series = Object.values(data).map((count: any) => count || 0);
    }

    if (labels.length === 0) return null;

    return { labels, series };
  }, [data]);

  if (loading) {
    return <ChartSkeleton height={320} showTitle={true} title="Phân bố theo trạng thái" />;
  }

  if (!chartData || chartData.labels.length === 0) {
    return (
      <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Phân bố theo trạng thái
        </h3>
        <div className="h-80 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-center">
            <AcademicCapIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Không có dữ liệu</p>
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
    labels: chartData.labels,
    // Dùng trực tiếp CSS variables để luôn bám theo theme hiện tại
    colors: ['var(--color-primary)', '#6b7280', 'var(--color-primary-light)'],
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
              label: 'Tổng',
              fontSize: '14px',
              fontWeight: 600,
              formatter: () => {
                const total = chartData.series.reduce((sum, val) => sum + val, 0);
                return total.toString();
              },
            },
          },
        },
      },
    },
  };

  return (
    <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Phân bố theo trạng thái
      </h3>
      <Chart
        options={chartOptions}
        series={chartData.series}
        type="donut"
        height={320}
      />
    </div>
  );
}

// Top Classes by Students Chart Component
export function TopClassesByStudentsChart({
  data,
  loading
}: {
  data: any[];
  loading: boolean;
}) {
  const theme = useThemeColors();
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null;

    // Lấy top 10 lớp
    const topClasses = data.slice(0, 10);
    // Truncate tên lớp dài để tránh đè lên nhau (horizontal bar nên có thể dài hơn)
    const categories = topClasses.map((item: any) => {
      const className = item.class_name || 'Không tên';
      return className.length > 30 ? `${className.substring(0, 30)}...` : className;
    });
    const series = topClasses.map((item: any) => item.student_count || 0);

    return { categories, series, fullNames: topClasses.map((item: any) => item.class_name || 'Không tên') };
  }, [data]);

  if (loading) {
    return <ChartSkeleton height={320} showTitle={true} title="Top lớp có nhiều học viên nhất" />;
  }

  if (!chartData || chartData.categories.length === 0) {
    return (
      <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Top lớp có nhiều học viên nhất
        </h3>
        <div className="h-80 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-center">
            <AcademicCapIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Không có dữ liệu</p>
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
        horizontal: true,
        borderRadius: 4,
        dataLabels: {
          position: 'right',
        },
      },
    },
    dataLabels: {
      enabled: true,
      formatter: (val: number) => `${val} học viên`,
      offsetX: 10,
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
          fontSize: '11px',
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
      colors: [theme.primary],
    },
    colors: [theme.primary],
    tooltip: {
      theme: 'dark',
      y: {
        formatter: (val: number) => `${val} học viên`,
      },
    },
  };

  return (
    <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Top lớp có nhiều học viên nhất
      </h3>
      <Chart
        options={chartOptions}
        series={[{ name: 'Số học viên', data: chartData.series }]}
        type="bar"
        height={320}
      />
    </div>
  );
}

// Assignments by Status Chart Component
export function AssignmentsByStatusChart({
  data,
  loading
}: {
  data: any[];
  loading: boolean;
}) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null;

    const statusLabels: Record<string, string> = {
      'published': 'Đã công bố',
      'draft': 'Bản nháp',
      'closed': 'Đã đóng',
    };

    const labels = data.map((item: any) =>
      statusLabels[item.status] || item.status || 'Khác'
    );
    const series = data.map((item: any) => item.count || 0);

    return { labels, series };
  }, [data]);

  if (loading) {
    return <ChartSkeleton height={320} showTitle={true} title="Phân bố theo trạng thái" />;
  }

  if (!chartData || chartData.labels.length === 0) {
    return (
      <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Phân bố theo trạng thái
        </h3>
        <div className="h-80 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-center">
            <ClipboardDocumentListIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Không có dữ liệu</p>
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
    labels: chartData.labels,
    // Dùng trực tiếp CSS variables để bám theo theme (không phụ thuộc hook)
    colors: ['var(--color-primary)', '#6b7280', 'var(--color-primary-light)'],
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
              label: 'Tổng',
              fontSize: '14px',
              fontWeight: 600,
              formatter: () => {
                const total = chartData.series.reduce((sum, val) => sum + val, 0);
                return total.toString();
              },
            },
          },
        },
      },
    },
  };

  return (
    <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Phân bố theo trạng thái
      </h3>
      <Chart
        options={chartOptions}
        series={chartData.series}
        type="donut"
        height={320}
      />
    </div>
  );
}

// Assignments by Grade Chart Component
export function AssignmentsByGradeChart({
  data,
  loading
}: {
  data: any[];
  loading: boolean;
}) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null;

    // API trả về grade_range (ví dụ: 'F (<60)', 'D (60-69)', 'C (70-79)', 'B (80-89)', 'A (90-100)')
    const categories = data.map((item: any) => {
      // Ưu tiên grade_range từ API
      const gradeValue = item.grade_range || item.grade || item.grade_name || item.grade_type || item.grade_value || item.name;

      // Nếu grade_range đã có format đẹp (ví dụ: 'F (<60)'), giữ nguyên
      if (gradeValue && typeof gradeValue === 'string' && gradeValue.includes('(')) {
        return gradeValue;
      }

      // Nếu grade là số (0-10), format thành "Điểm X"
      if (typeof gradeValue === 'number') {
        return `Điểm ${gradeValue}`;
      }

      // Nếu grade là string rỗng hoặc null/undefined
      if (!gradeValue || gradeValue === '' || gradeValue === 'null' || gradeValue === 'undefined') {
        return 'Chưa có điểm';
      }

      // Nếu grade là chữ cái đơn (A, B, C, D, F), format thành "Điểm X"
      return `Điểm ${gradeValue}`;
    });

    const series = data.map((item: any) => item.count || 0);
    const colors = data.map((item: any) => {
      // Lấy grade_range từ API (ví dụ: 'F (<60)', 'A (90-100)')
      const gradeRange = item.grade_range || item.grade || item.grade_name || item.grade_type || item.grade_value || item.name;

      // Extract chữ cái đầu từ grade_range (ví dụ: 'F (<60)' -> 'F')
      let gradeLetter = '';
      if (gradeRange && typeof gradeRange === 'string') {
        // Nếu có format như 'F (<60)', lấy chữ cái đầu
        if (gradeRange.includes('(')) {
          gradeLetter = gradeRange.charAt(0).toUpperCase();
        } else {
          // Nếu chỉ là chữ cái, lấy chữ cái đầu
          gradeLetter = gradeRange.charAt(0).toUpperCase();
        }
      } else if (typeof gradeRange === 'number') {
        // Nếu grade là số, map theo khoảng điểm (dùng CSS variables theo theme)
        if (gradeRange >= 8.5) return 'var(--color-primary)';       // A
        if (gradeRange >= 7.0) return 'var(--color-primary-light)'; // B
        if (gradeRange >= 5.5) return 'var(--color-primary-light)'; // C
        if (gradeRange >= 4.0) return 'var(--color-primary)';       // D
        return 'var(--color-primary)';                              // F
      }

      // Map màu theo chữ cái (A, B, C, D, F)
      const gradeColor = GRADE_COLORS[gradeLetter] || GRADE_DEFAULT_COLOR;
      // Map class-based màu (green / yellow / red / blue / orange) sang palette theo CSS variables của theme
      if (gradeColor.includes('green')) return 'var(--color-primary)';
      if (gradeColor.includes('yellow')) return 'var(--color-primary-light)';
      if (gradeColor.includes('red')) return 'var(--color-primary)';
      if (gradeColor.includes('blue')) return 'var(--color-primary-light)';
      if (gradeColor.includes('orange')) return 'var(--color-primary)';
      return '#6b7280';
    });

    return { categories, series, colors };
  }, [data]);

  if (loading) {
    return <ChartSkeleton height={320} showTitle={true} title="Phân bố điểm số" />;
  }

  if (!chartData || chartData.categories.length === 0) {
    return (
      <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Phân bố điểm số
        </h3>
        <div className="h-80 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-center">
            <ChartBarIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Không có dữ liệu</p>
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
        columnWidth: '60%',
        borderRadius: 4,
        dataLabels: {
          position: 'top',
        },
      },
    },
    dataLabels: {
      enabled: true,
      formatter: (val: number) => val.toString(),
      offsetY: -20,
      style: {
        fontSize: '12px',
        colors: ['#6b7280'],
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
    fill: {
      opacity: 1,
    },
    colors: chartData.colors,
    tooltip: {
      theme: 'dark',
      y: {
        formatter: (val: number) => `${val} bài tập`,
      },
    },
  };

  return (
    <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Phân bố điểm số
      </h3>
      <Chart
        options={chartOptions}
        series={[{ name: 'Số bài tập', data: chartData.series }]}
        type="bar"
        height={320}
      />
    </div>
  );
}

// Grade Stats Chart Component
export function GradeStatsChart({
  data,
  loading
}: {
  data: any;
  loading: boolean;
}) {
  const theme = useThemeColors();
  const chartData = useMemo(() => {
    if (!data) return null;

    const categories = ['Điểm trung bình', 'Điểm cao nhất', 'Điểm thấp nhất'];
    const series = [
      data.average ? Math.round(data.average) : 0,
      data.max || 0,
      data.min || 0,
    ];

    return { categories, series };
  }, [data]);

  if (loading) {
    return <ChartSkeleton height={320} showTitle={true} title="Thống kê điểm số" />;
  }

  if (!chartData) {
    return null;
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
        columnWidth: '60%',
        borderRadius: 4,
        dataLabels: {
          position: 'top',
        },
      },
    },
    dataLabels: {
      enabled: true,
      formatter: (val: number) => val.toString(),
      offsetY: -20,
      style: {
        fontSize: '14px',
        fontWeight: 600,
        colors: ['#6b7280'],
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
    fill: {
      opacity: 1,
      colors: [theme.primaryLight, theme.primary, theme.primaryLight],
    },
    colors: [theme.primaryLight, theme.primary, theme.primaryLight],
    tooltip: {
      theme: 'dark',
      y: {
        formatter: (val: number) => `${val} điểm`,
      },
    },
  };

  return (
    <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Thống kê điểm số
      </h3>
      <Chart
        options={chartOptions}
        series={[{ name: 'Điểm', data: chartData.series }]}
        type="bar"
        height={320}
      />
    </div>
  );
}


// Payments by Status Chart Component
export function PaymentsByStatusChart({
  data,
  loading
}: {
  data: any[];
  loading: boolean;
}) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null;

    const statusLabels: Record<string, string> = {
      'paid': 'Đã thanh toán',
      'pending': 'Chờ thanh toán',
      'failed': 'Thất bại',
      'refunded': 'Đã hoàn tiền',
    };

    const labels = data.map((item: any) =>
      item.status_label || statusLabels[item.status] || item.status || 'Khác'
    );
    const series = data.map((item: any) => item.count || 0);

    return { labels, series };
  }, [data]);

  if (loading) {
    return <ChartSkeleton height={320} showTitle={true} title="Phân bố theo trạng thái" />;
  }

  if (!chartData || chartData.labels.length === 0) {
    return (
      <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Phân bố theo trạng thái
        </h3>
        <div className="h-80 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-center">
            <CreditCardIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Không có dữ liệu</p>
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
    labels: chartData.labels,
    // Dùng CSS variables để luôn khớp với theme hiện tại
    colors: [
      'var(--color-primary)',              // trạng thái 1
      'var(--color-primary-light)',       // trạng thái 2
      'var(--color-primary)',             // trạng thái 3
      '#6b7280',                          // trạng thái khác / xám
    ],
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
              label: 'Tổng',
              fontSize: '14px',
              fontWeight: 600,
              formatter: () => {
                const total = chartData.series.reduce((sum, val) => sum + val, 0);
                return total.toString();
              },
            },
          },
        },
      },
    },
  };

  return (
    <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Phân bố theo trạng thái
      </h3>
      <Chart
        options={chartOptions}
        series={chartData.series}
        type="donut"
        height={320}
      />
    </div>
  );
}

// Overview Revenue Trend Chart Component
export function OverviewRevenueTrendChart({
  revenueData,
  paymentsReportData,
  loading
}: {
  revenueData: any[];
  paymentsReportData: any;
  loading: boolean;
}) {
  const theme = useThemeColors();
  const chartData = useMemo(() => {
    // Ưu tiên sử dụng paymentsReportData.trend vì có dữ liệu thực tế
    const trendData = paymentsReportData?.trend || [];

    if (trendData.length > 0) {
      return {
        categories: trendData.map((item: any) => {
          if (!item.date) return '';
          // Format date to DD/MM/YYYY
          const date = new Date(item.date);
          return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }),
        series: trendData.map((item: any) => item.total || 0),
      };
    }

    if (revenueData && revenueData.length > 0) {
      return {
        categories: revenueData.map((item: any) => {
          if (!item.date) return '';
          const date = new Date(item.date);
          return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }),
        series: revenueData.map((item: any) => item.total || 0),
      };
    }

    return null;
  }, [revenueData, paymentsReportData]);

  if (loading) {
    return <ChartSkeleton height={320} showTitle={true} title="Xu hướng doanh thu" />;
  }

  if (!chartData || chartData.categories.length === 0) {
    return (
      <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Xu hướng doanh thu
        </h3>
        <div className="h-80 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-center">
            <CurrencyDollarIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Không có dữ liệu</p>
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
      zoom: {
        enabled: false,
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      curve: 'smooth',
      width: 3,
    },
    markers: {
      size: 5,
      hover: {
        size: 7,
      },
    },
    xaxis: {
      categories: chartData.categories,
      labels: {
        style: {
          colors: '#6b7280',
          fontSize: '11px',
        },
        rotate: -45,
        rotateAlways: true,
        maxHeight: 80,
        offsetY: 10,
      },
      tickAmount: chartData.categories.length > 10 ? Math.ceil(chartData.categories.length / 2) : undefined,
    },
    yaxis: {
      labels: {
        style: {
          colors: '#6b7280',
        },
        formatter: (val: number) => {
          return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
            notation: 'compact',
            maximumFractionDigits: 1
          }).format(val);
        },
      },
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.7,
        opacityTo: 0.3,
        stops: [0, 90, 100],
      },
    },
    colors: [theme.primary],
    tooltip: {
      theme: 'dark',
      y: {
        formatter: (val: number) => {
          return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
          }).format(val);
        },
      },
    },
  };

  return (
    <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Xu hướng doanh thu
      </h3>
      <Chart
        options={chartOptions}
        series={[{ name: 'Doanh thu', data: chartData.series }]}
        type="line"
        height={320}
      />
    </div>
  );
}

// Overview Metrics Comparison Chart Component
export function OverviewMetricsComparisonChart({
  overviewData,
  attendanceRate,
  totalAssignments,
  loading
}: {
  overviewData: any;
  attendanceRate?: number;
  totalAssignments?: number;
  loading: boolean;
}) {
  const theme = useThemeColors();
  const chartData = useMemo(() => {
    if (!overviewData) return null;

    // Normalize các metrics để so sánh (scale về 0-100)
    // Sử dụng log scale để so sánh các giá trị có độ lớn khác nhau
    const normalize = (val: number) => {
      if (val === 0) return 0;
      return Math.log10(val + 1) * 10; // Log scale để so sánh các giá trị khác nhau
    };

    return {
      categories: ['Học viên', 'Lớp học', 'Doanh thu', 'Tỷ lệ đi học (%)', 'Bài tập'],
      series: [
        normalize(overviewData.total_students || 0),
        normalize(overviewData.total_classes || 0),
        normalize(overviewData.total_revenue || 0), // Không chia cho 1 triệu, giữ nguyên giá trị
        normalize(attendanceRate || 0),
        normalize(totalAssignments || 0),
      ],
      actualValues: [
        overviewData.total_students || 0,
        overviewData.total_classes || 0,
        overviewData.total_revenue || 0, // Giữ nguyên giá trị để format đúng
        attendanceRate || 0,
        totalAssignments || 0,
      ],
    };
  }, [overviewData, attendanceRate, totalAssignments]);

  if (loading) {
    return (
      <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          So sánh các chỉ số chính
        </h3>
        <div className="h-80 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-lg animate-pulse">
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div className="h-16 w-16 rounded-lg bg-gray-200 dark:bg-gray-600 mx-auto mb-4" />
              <div className="h-4 w-48 rounded bg-gray-200 dark:bg-gray-600 mx-auto" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!chartData) {
    return null;
  }

  const chartOptions: any = {
    chart: {
      type: 'bar',
      toolbar: { show: false },
      fontFamily: 'inherit',
    },
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 4,
        dataLabels: {
          position: 'right',
        },
      },
    },
    dataLabels: {
      enabled: true,
      formatter: (val: number, opts: any) => {
        const index = opts.dataPointIndex;
        const actualValue = chartData.actualValues[index];
        if (index === 2) {
          // Format doanh thu giống RevenueChartComponent
          return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
            notation: 'compact',
            maximumFractionDigits: 1
          }).format(actualValue);
        }
        if (index === 3) return `${actualValue.toFixed(1)}%`;
        return actualValue.toString();
      },
      offsetX: 10,
      style: {
        fontSize: '12px',
        fontWeight: 600,
        colors: ['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff'],
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
    fill: {
      opacity: 1,
      colors: [theme.primaryLight, theme.primary, theme.primaryLight, theme.primaryLight, theme.primary],
    },
    colors: [theme.primaryLight, theme.primary, theme.primaryLight, theme.primaryLight, theme.primary],
    tooltip: {
      theme: 'dark',
      y: {
        formatter: (val: number, opts: any) => {
          const index = opts.dataPointIndex;
          const actualValue = chartData.actualValues[index];
          if (index === 2) {
            // Format doanh thu giống RevenueChartComponent
            return new Intl.NumberFormat('vi-VN', {
              style: 'currency',
              currency: 'VND'
            }).format(actualValue);
          }
          if (index === 3) return `${actualValue.toFixed(1)}%`;
          return actualValue.toString();
        },
      },
    },
  };

  return (
    <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        So sánh các chỉ số chính
      </h3>
      <Chart
        options={chartOptions}
        series={[{ name: 'Giá trị', data: chartData.series }]}
        type="bar"
        height={320}
      />
    </div>
  );
}
