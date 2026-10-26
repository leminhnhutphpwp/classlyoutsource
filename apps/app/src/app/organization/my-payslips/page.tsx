"use client";

import { useState } from "react";
import {
  ArrowLeftIcon,
  BanknotesIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import ButtonLink from "@/components/Common/ButtonLink";
import { TableSkeleton } from "@/components/ui/loading";
import ErrorDisplay from "@/components/Common/ErrorDisplay";
import { useOrganizationContext } from "@/contexts/organization-context";
import { useMyPayslips } from "@/hooks/use-api";
import { OrgFeatureGuard } from "../_components/org-guard";
import { Panel, EmptyRow, TableHead } from "../_components/finance-ui";
import { money } from "../_components/finance-format";
import type { MyPayslip } from "@/types/org-payroll";

export default function MyPayslipsPage() {
  const { hasOrg, organization } = useOrganizationContext();
  const orgHash = organization?.id;
  const { data, loading, error, refetch } = useMyPayslips(orgHash);
  const list = data ?? [];

  return (
    <OrgFeatureGuard allowed={hasOrg}>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <ButtonLink
            href="/organization"
            variant="outline"
            size="sm"
            icon={<ArrowLeftIcon />}
            className="w-full justify-center sm:w-auto"
            lockAware={false}
          >
            Quay lại
          </ButtonLink>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 text-xl font-bold text-dark dark:text-white sm:text-2xl">
              <BanknotesIcon className="h-6 w-6 text-primary" />
              Bảng lương của tôi
            </h1>
            <p className="mt-1 text-dark-4 dark:text-dark-6">
              Các phiếu lương đã được duyệt của bạn
            </p>
          </div>
        </div>

        {error && !loading ? (
          <ErrorDisplay title="Không tải được phiếu lương" error={error} onRetry={() => refetch()} />
        ) : (
          <Panel title="Phiếu lương" subtitle={`${list.length} phiếu lương`}>
            {loading && list.length === 0 ? (
              <div className="p-4 sm:p-6">
                <TableSkeleton rows={4} cols={3} />
              </div>
            ) : list.length === 0 ? (
              <EmptyRow message="Bạn chưa có phiếu lương nào được duyệt." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <TableHead>
                    <tr>
                      <th className="px-4 py-3 sm:px-6">Kỳ lương</th>
                      <th className="px-4 py-3">Ngày trả</th>
                      <th className="px-4 py-3 text-right sm:px-6">Số tiền</th>
                    </tr>
                  </TableHead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {list.map((p) => (
                      <PayslipRow key={p.id} payslip={p} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        )}
      </div>
    </OrgFeatureGuard>
  );
}

function PayslipRow({ payslip }: { payslip: MyPayslip }) {
  const [expanded, setExpanded] = useState(false);
  const hasBreakdown = !!payslip.breakdown && payslip.breakdown.length > 0;
  return (
    <>
      <tr className="text-gray-900 dark:text-gray-200">
        <td className="px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => hasBreakdown && setExpanded((v) => !v)}
            className={`flex items-center gap-1.5 font-medium ${
              hasBreakdown ? "hover:text-primary" : "cursor-default"
            }`}
          >
            {hasBreakdown && (
              <ChevronDownIcon
                className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
              />
            )}
            {payslip.period_label ||
              `${payslip.period_start ?? ""} → ${payslip.period_end ?? ""}`}
          </button>
        </td>
        <td className="px-4 py-3">{payslip.paid_at ?? "Chưa trả"}</td>
        <td className="px-4 py-3 text-right font-semibold sm:px-6">{money(payslip.amount)}</td>
      </tr>
      {expanded && hasBreakdown && (
        <tr className="bg-gray-50 dark:bg-gray-900/40">
          <td colSpan={3} className="px-4 py-3 sm:px-6">
            <ul className="space-y-1 text-sm">
              {payslip.breakdown!.map((b, i) => (
                <li key={i} className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">{b.label}</span>
                  <span>{b.text ?? money(b.amount)}</span>
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}
