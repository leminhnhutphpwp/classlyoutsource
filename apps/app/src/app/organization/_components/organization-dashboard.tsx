"use client";

import {
  UserGroupIcon,
  AcademicCapIcon,
  UsersIcon,
  BanknotesIcon,
} from "@heroicons/react/24/outline";
import { useOrganizationDashboard } from "@/hooks/use-api";
import { StatsCardSkeleton, TableSkeleton } from "@/components/ui/loading";
import ErrorDisplay from "@/components/Common/ErrorDisplay";
import { RoleBadge } from "./org-ui";
import type { OrgRole, OrgTutorBreakdown } from "@/types/organization";
import { formatCurrency as formatCurrencyFull } from "@/lib/format-currency";
import { cn } from "@/lib/utils";

function formatNumber(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n.toLocaleString("vi-VN") : "0";
}

// Dùng formatter dùng chung của app thay vì bản sao cục bộ: bản cũ vừa in ký hiệu khác
// ("₫" thay vì "đ"), vừa luôn trả số đầy đủ nên thẻ "Doanh thu tháng" tràn/bị cắt với số 9 chữ số.
function formatCurrency(value: unknown): string {
  return formatCurrencyFull(typeof value === "number" ? value : Number(value ?? 0));
}

/**
 * Bảng điều khiển trung tâm: số liệu tổng hợp + breakdown theo từng giáo viên.
 * Dữ liệu từ GET /organizations/{orgHash}/dashboard.
 */
export function OrganizationDashboard({ orgHash }: { orgHash: string }) {
  const { data, loading, error, refetch } = useOrganizationDashboard(orgHash);

  const stats = data?.statistics ?? {};
  const tutors: OrgTutorBreakdown[] = Array.isArray(data?.tutor_breakdown)
    ? data!.tutor_breakdown!
    : [];

  const statCards = [
    { label: "Giáo viên", value: formatNumber(tutors.length), icon: UserGroupIcon },
    { label: "Lớp học", value: formatNumber(stats.total_classes), icon: AcademicCapIcon },
    { label: "Học viên", value: formatNumber(stats.total_students), icon: UsersIcon },
    {
      label: "Doanh thu tháng",
      // Số đầy đủ, KHÔNG viết tắt. Thẻ chống tràn bằng cách giảm cỡ chữ (xem `moneySize` bên dưới).
      value: formatCurrency(stats.revenue_this_month),
      isMoney: true,
      icon: BanknotesIcon,
    },
  ];

  if (error && !loading) {
    return (
      <ErrorDisplay
        title="Không tải được số liệu trung tâm"
        error={error}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Aggregate stats */}
      <div className="grid grid-cols-2 gap-4 md:gap-6 xl:grid-cols-4">
        {loading ? (
          <>
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
          </>
        ) : (
          statCards.map((s) => (
            <div key={s.label} className="rounded-lg bg-white p-4 dark:bg-gray-800 md:p-6">
              <div className="flex items-center">
                <div className="rounded-lg bg-primary-pastel/40 p-2">
                  <s.icon className="h-5 w-5 text-primary md:h-6 md:w-6" />
                </div>
                <div className="ml-3 md:ml-4">
                  <p className="truncate text-[10px] font-medium text-gray-500 dark:text-gray-400 sm:text-xs md:text-sm">
                    {s.label}
                  </p>
                  <p
                    className={cn(
                      "font-semibold tabular-nums whitespace-nowrap text-gray-900 dark:text-white",
                      // Số tiền dài thì giảm cỡ chữ để vừa ô, thay vì cắt bớt chữ số.
                      (s as { isMoney?: boolean }).isMoney && s.value.length > 13
                        ? "text-base md:text-lg"
                        : (s as { isMoney?: boolean }).isMoney && s.value.length > 10
                          ? "text-lg md:text-xl"
                          : "text-xl md:text-2xl",
                    )}
                    title={s.value}
                  >
                    {s.value}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Per-tutor breakdown */}
      <div className="rounded-lg bg-white dark:bg-gray-800">
        <div className="border-b border-gray-200 px-4 py-4 dark:border-gray-700 sm:px-6">
          <h3 className="text-base font-semibold text-dark dark:text-white sm:text-lg">
            Chi tiết theo giáo viên
          </h3>
          <p className="mt-1 text-sm text-dark-4 dark:text-dark-6">
            Đóng góp của từng thành viên trong trung tâm
          </p>
        </div>

        {loading ? (
          <div className="p-4 sm:p-6">
            <TableSkeleton rows={4} cols={5} />
          </div>
        ) : tutors.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
            Chưa có dữ liệu giáo viên để hiển thị.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-gray-2 text-xs uppercase text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 sm:px-6">Giáo viên</th>
                  <th className="px-4 py-3">Vai trò</th>
                  <th className="px-4 py-3 text-right">Lớp học</th>
                  <th className="px-4 py-3 text-right">Học viên</th>
                  <th className="px-4 py-3 text-right">Doanh thu tháng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {tutors.map((t, idx) => (
                  <tr key={t.tutor_id ?? idx} className="text-gray-900 dark:text-gray-200">
                    <td className="px-4 py-3 sm:px-6">
                      <div className="font-medium">{t.tutor_name ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3">
                      {t.org_role ? <RoleBadge role={t.org_role as OrgRole} /> : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">{formatNumber(t.total_classes)}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(t.total_students)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(t.revenue_this_month)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
