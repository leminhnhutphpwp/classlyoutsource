"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PlusIcon } from "@heroicons/react/24/outline";
import Button from "@/components/Common/Button";
import FormModal from "@/components/Common/FormModal";
import InputGroup from "@/components/FormElements/InputGroup";
import { TableSkeleton } from "@/components/ui/loading";
import ErrorDisplay from "@/components/Common/ErrorDisplay";
import { useOrganizationContext } from "@/contexts/organization-context";
import { useNotification } from "@/hooks/use-notification";
import { extractErrorMessage } from "@/lib/api-error-utils";
import { usePayrollPeriods, useCreatePayrollPeriod } from "@/hooks/use-api";
import { Panel, EmptyRow, TableHead } from "./finance-ui";
import { PeriodStatusBadge, CalcStatusBadge, calcInFlight } from "./payroll-ui";
import { money } from "./finance-format";

export function PayrollPeriods({ orgHash }: { orgHash: string }) {
  const { canManagePayroll } = useOrganizationContext();
  const { data, loading, error, refetch } = usePayrollPeriods(orgHash);
  const { mutate: createPeriod, loading: creating } = useCreatePayrollPeriod();
  const { success, error: showError } = useNotification();

  const periods = data ?? [];

  // Job "tính lương" chạy nền theo kỳ: có kỳ đang queued/computing thì tự poll
  // 3s để badge cập nhật xong/lỗi mà người dùng không phải F5.
  const anyInFlight = periods.some((p) => calcInFlight(p.calculation_status));
  useEffect(() => {
    if (!anyInFlight) return;
    const interval = setInterval(() => refetch(), 3000);
    return () => clearInterval(interval);
  }, [anyInFlight, refetch]);
  const [formOpen, setFormOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [err, setErr] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!start || !end) {
      setErr("Vui lòng chọn ngày bắt đầu và kết thúc kỳ lương.");
      return;
    }
    setErr("");
    const res = await createPeriod(orgHash, {
      label: label.trim() || undefined,
      period_start: start,
      period_end: end,
    });
    if (res.success) {
      success("Đã tạo kỳ lương");
      setFormOpen(false);
      setLabel("");
      setStart("");
      setEnd("");
      refetch();
    } else {
      showError(extractErrorMessage(res, "Không thể tạo kỳ lương."));
    }
  };

  if (error && !loading) {
    return (
      <ErrorDisplay
        title="Không tải được kỳ lương"
        error={error}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-4">
      {canManagePayroll && formOpen && (
        <FormModal
          title="Tạo kỳ lương"
          onClose={() => setFormOpen(false)}
          closeDisabled={creating}
        >
          <form onSubmit={handleCreate}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <InputGroup
                label="Tên kỳ (tuỳ chọn)"
                name="label"
                type="text"
                value={label}
                handleChange={(e) => setLabel(e.target.value)}
                placeholder="VD: Lương tháng 7/2026"
              />
              <InputGroup
                label="Từ ngày"
                name="start"
                type="date"
                value={start}
                handleChange={(e) => setStart(e.target.value)}
                required
              />
              <InputGroup
                label="Đến ngày"
                name="end"
                type="date"
                value={end}
                handleChange={(e) => setEnd(e.target.value)}
                required
              />
            </div>
            {err && <p className="mt-3 text-sm text-red-500">{err}</p>}
            <div className="mt-5 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
                lockAware={false}
                disabled={creating}
              >
                Hủy
              </Button>
              <Button type="submit" loading={creating} disabled={creating}>
                Tạo kỳ lương
              </Button>
            </div>
          </form>
        </FormModal>
      )}

      <Panel
        title="Kỳ lương"
        subtitle="Các kỳ tính lương của trung tâm"
        action={
          canManagePayroll ? (
            <Button
              icon={<PlusIcon />}
              size="sm"
              onClick={() => setFormOpen(true)}
            >
              Tạo kỳ lương
            </Button>
          ) : undefined
        }
      >
        {loading && periods.length === 0 ? (
          <div className="p-4 sm:p-6">
            <TableSkeleton rows={4} cols={5} />
          </div>
        ) : periods.length === 0 ? (
          <EmptyRow message="Chưa có kỳ lương nào." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <TableHead>
                <tr>
                  <th className="px-4 py-3 sm:px-6">Kỳ lương</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Tổng chi</th>
                  <th className="px-4 py-3 text-right sm:px-6">Chi tiết</th>
                </tr>
              </TableHead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {periods.map((p) => (
                  <tr key={p.id} className="text-gray-900 dark:text-gray-200">
                    <td className="px-4 py-3 sm:px-6">
                      <div className="font-medium">
                        {p.label || `Kỳ ${p.period_start ?? ""}`}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {p.period_start} → {p.period_end}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <PeriodStatusBadge status={p.status} />
                        {/* Vòng đời tính lương riêng với trạng thái kỳ: đang
                            chạy / lỗi phải thấy được ngay ở danh sách. */}
                        <CalcStatusBadge status={p.calculation_status} />
                      </div>
                      {p.calculation_status === "failed" && (
                        <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                          {p.calculation_error || "Tính lương thất bại"} —{" "}
                          <Link
                            href={`/organization/payroll/${p.id}`}
                            className="font-medium underline hover:no-underline"
                          >
                            mở để thử lại
                          </Link>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {money(p.total_net ?? p.total_gross)}
                    </td>
                    <td className="px-4 py-3 text-right sm:px-6">
                      <Link
                        href={`/organization/payroll/${p.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        Xem
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
