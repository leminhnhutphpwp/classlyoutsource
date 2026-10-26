"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  CalculatorIcon,
  CheckCircleIcon,
  BanknotesIcon,
  XCircleIcon,
  ChevronDownIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import ButtonLink from "@/components/Common/ButtonLink";
import Button from "@/components/Common/Button";
import InputGroup from "@/components/FormElements/InputGroup";
import SelectInput from "@/components/FormElements/SelectInput";
import { PageSkeleton, TableSkeleton } from "@/components/ui/loading";
import ErrorDisplay from "@/components/Common/ErrorDisplay";
import { formatAmount, parseAmount } from "@/lib/format-currency";
import { useOrganizationContext } from "@/contexts/organization-context";
import { useNotification } from "@/hooks/use-notification";
import { extractErrorMessage } from "@/lib/api-error-utils";
import {
  usePayrollPeriod,
  usePayrollItems,
  useComputePayrollPeriod,
  useApprovePayrollPeriod,
  useMarkPayrollPeriodPaid,
  useCancelPayrollPeriod,
  useCreatePayrollAdjustment,
} from "@/hooks/use-api";
import { Panel, EmptyRow, TableHead } from "./finance-ui";
import { PeriodStatusBadge, PERIOD_STATUS_LABELS, calcInFlight } from "./payroll-ui";
import { CalculationStatusPanel } from "./payroll-calc-status";
import { money, signedMoney, amountColor } from "./finance-format";
import type { PayrollItem, CreateAdjustmentPayload } from "@/types/org-payroll";

export function PayrollPeriodDetail({
  orgHash,
  periodId,
}: {
  orgHash: string;
  periodId: string;
}) {
  const { canManagePayroll, canMarkPayrollPaid } = useOrganizationContext();
  const {
    data: period,
    loading: periodLoading,
    error: periodError,
    refetch: refetchPeriod,
  } = usePayrollPeriod(orgHash, periodId);
  const {
    data: items,
    loading: itemsLoading,
    refetch: refetchItems,
  } = usePayrollItems(orgHash, periodId);

  const { mutate: compute, loading: computing } = useComputePayrollPeriod();
  const { mutate: approve, loading: approving } = useApprovePayrollPeriod();
  const { mutate: markPaid, loading: markingPaid } = useMarkPayrollPeriodPaid();
  const { mutate: cancel, loading: cancelling } = useCancelPayrollPeriod();
  const { success, info, error: showError } = useNotification();

  const refetchAll = () => {
    refetchPeriod();
    refetchItems();
  };

  const status = period?.status;
  const list = items ?? [];
  const hasItems = list.length > 0;
  const calculationStatus = period?.calculation_status;
  // "queued" (chờ worker nhận) lẫn "computing" (đang tính) đều là job đang chạy.
  const calculationInProgress = calcInFlight(calculationStatus);
  const calculationCompleted = calculationStatus
    ? calculationStatus === "completed"
    : Boolean(period?.computed_at);
  // The API remains source-of-truth. `computed_at` is mandatory for approval even when older
  // responses do not expose an explicit calculation lifecycle.
  const canCompute = canManagePayroll && status === "draft" && !calculationInProgress;
  const canApprove = canManagePayroll && status === "draft" && hasItems && calculationCompleted && !computing;
  const canMark = canMarkPayrollPaid && status === "approved";
  const canCancel = canManagePayroll && status === "draft" && !calculationInProgress;
  const canAdjust = canManagePayroll && status === "approved";

  const runAction = async (
    fn: (
      o: string,
      p: string,
    ) => Promise<{ success: boolean; message?: string }>,
    okTitle: string,
    okMsg?: string,
    queued = false,
  ) => {
    const res = await fn(orgHash, periodId);
    if (res.success) {
      if (queued) info(okTitle, okMsg);
      else success(okTitle, okMsg);
      refetchAll();
    } else {
      showError(
        extractErrorMessage(res, "Thao tác thất bại. Vui lòng thử lại."),
      );
    }
  };

  // ---- Job nền "tính lương": tự theo dõi, đừng bắt người dùng tự mò F5 ------
  // Poll mỗi 3s CHỈ khi lượt tính đang chạy (queued/computing); xong/lỗi thì dừng.
  useEffect(() => {
    if (!calculationInProgress) return;
    const interval = setInterval(() => refetchPeriod(), 3000);
    return () => clearInterval(interval);
  }, [calculationInProgress, refetchPeriod]);

  // Bắt transition "đang chạy → completed/failed": báo toast + kéo lại phiếu
  // lương (items đã đổi ở server). Bỏ qua lần render đầu và các transition khác.
  const lastCalcRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const prev = lastCalcRef.current;
    lastCalcRef.current = calculationStatus ?? null;
    if (prev === undefined || !calcInFlight(prev)) return;
    if (calculationStatus === "completed") {
      success("Đã tính xong lương", "Kết quả mới đã được cập nhật bên dưới.");
      refetchItems();
    } else if (calculationStatus === "failed") {
      showError(
        "Tính lương thất bại",
        period?.calculation_error || "Đã xảy ra lỗi. Vui lòng thử lại.",
      );
      refetchItems();
    }
    // period?.calculation_error được đọc ở đúng render có calculationStatus mới — đủ mới.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculationStatus]);

  if (periodError && !periodLoading) {
    return (
      <ErrorDisplay
        title="Không tải được kỳ lương"
        error={periodError}
        onRetry={() => refetchPeriod()}
      />
    );
  }

  if (periodLoading && !period) {
    return <PageSkeleton showHeader showContent />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <ButtonLink
          href="/organization/payroll"
          variant="outline"
          size="sm"
          icon={<ArrowLeftIcon />}
          className="w-full justify-center sm:w-auto"
          lockAware={false}
        >
          Quay lại
        </ButtonLink>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold text-dark dark:text-white sm:text-2xl">
              {period?.label || "Kỳ lương"}
            </h1>
            {status && <PeriodStatusBadge status={status} />}
          </div>
          <p className="mt-1 text-dark-4 dark:text-dark-6">
            {period?.period_start} → {period?.period_end}
          </p>
        </div>
      </div>

      {/* Thao tác theo state machine */}
      <div className="flex flex-wrap gap-2">
        <Button
          icon={<CalculatorIcon />}
          onClick={() =>
            runAction(
              compute,
              "Đã gửi yêu cầu tính lương",
              "Job chạy nền — theo dõi tiến trình ngay tại đây, trang tự cập nhật.",
              true,
            )
          }
          loading={computing}
          disabled={!canCompute || computing}
        >
          {hasItems ? "Tính lại" : "Tính lương"}
        </Button>
        <Button
          variant="secondary"
          icon={<CheckCircleIcon />}
          onClick={() => runAction(approve, "Đã duyệt kỳ lương")}
          loading={approving}
          disabled={!canApprove || approving}
        >
          Duyệt
        </Button>
        {canMarkPayrollPaid && (
          <Button
            variant="primary"
            icon={<BanknotesIcon />}
            onClick={() => runAction(markPaid, "Đã đánh dấu trả lương")}
            loading={markingPaid}
            disabled={!canMark || markingPaid}
          >
            Đánh dấu đã trả
          </Button>
        )}
        {canCancel && (
          <Button
            variant="danger"
            icon={<XCircleIcon />}
            onClick={() => runAction(cancel, "Đã hủy kỳ lương")}
            loading={cancelling}
            disabled={cancelling}
          >
            Hủy kỳ
          </Button>
        )}
      </div>

      {/* Trạng thái vòng đời TÍNH LƯƠNG (job nền) — hiện rõ đang chạy / xong / lỗi */}
      <CalculationStatusPanel
        period={period}
        onCompute={() =>
          runAction(
            compute,
            "Đã gửi yêu cầu tính lương",
            "Job chạy nền — theo dõi tiến trình ngay tại đây, trang tự cập nhật.",
            true,
          )
        }
        computing={computing}
      />

      {/* Bảng phiếu lương */}
      <Panel
        title="Phiếu lương"
        subtitle={`${list.length} giáo viên${
          period?.status ? ` · ${PERIOD_STATUS_LABELS[period.status]}` : ""
        }`}
      >
        {itemsLoading && list.length === 0 ? (
          <div className="p-4 sm:p-6">
            <TableSkeleton rows={5} cols={4} />
          </div>
        ) : list.length === 0 ? (
          <EmptyRow message="Chưa có phiếu lương. Hãy bấm “Tính lương”." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <TableHead>
                <tr>
                  <th className="px-4 py-3 sm:px-6">Giáo viên</th>
                  <th className="px-4 py-3 text-right">Lương gộp</th>
                  <th className="px-4 py-3 text-right">Điều chỉnh</th>
                  <th className="px-4 py-3 text-right sm:px-6">Thực nhận</th>
                </tr>
              </TableHead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {list.map((it) => (
                  <PayslipRow
                    key={it.id}
                    item={it}
                    orgHash={orgHash}
                    canAdjust={canAdjust}
                    onAdjusted={refetchAll}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function PayslipRow({
  item,
  orgHash,
  canAdjust,
  onAdjusted,
}: {
  item: PayrollItem;
  orgHash: string;
  canAdjust: boolean;
  onAdjusted: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const net = item.net ?? item.gross + (item.adjustments_total ?? 0);

  // Chỉ cho bung khi thật sự có gì bên trong. Panel gồm 3 khối và cả 3 đều có điều kiện,
  // nên với kỳ ĐÃ TRẢ (canAdjust = false) mà không có chi tiết lẫn điều chỉnh thì bung ra
  // chỉ thấy một khoảng trắng — người dùng bấm rồi tưởng hỏng. Không có gì thì bỏ luôn
  // mũi tên: đừng bày ra một nút dẫn đến chỗ trống.
  const hasBreakdown = (item.breakdown?.length ?? 0) > 0;
  const hasAdjustments = (item.adjustments?.length ?? 0) > 0;
  const canExpand = hasBreakdown || hasAdjustments || canAdjust;

  return (
    <>
      <tr className="text-gray-900 dark:text-gray-200">
        <td className="px-4 py-3 sm:px-6">
          {canExpand ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1.5 font-medium hover:text-primary"
            >
              <ChevronDownIcon
                className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
              />
              {item.tutor_name || item.tutor_id}
            </button>
          ) : (
            // Thụt lề bằng đúng bề rộng mũi tên để cột tên vẫn thẳng hàng với các dòng bung được.
            <span className="flex items-center gap-1.5 pl-[1.375rem] font-medium">
              {item.tutor_name || item.tutor_id}
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-right">{money(item.gross)}</td>
        <td
          className={`px-4 py-3 text-right ${amountColor(item.adjustments_total)}`}
        >
          {item.adjustments_total ? signedMoney(item.adjustments_total) : "—"}
        </td>
        <td className="px-4 py-3 text-right font-semibold sm:px-6">
          {money(net)}
        </td>
      </tr>
      {expanded && canExpand && (
        <tr className="bg-gray-50 dark:bg-gray-900/40">
          <td colSpan={4} className="px-4 py-3 sm:px-6">
            <PayslipDetail
              item={item}
              orgHash={orgHash}
              canAdjust={canAdjust}
              onAdjusted={onAdjusted}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function PayslipDetail({
  item,
  orgHash,
  canAdjust,
  onAdjusted,
}: {
  item: PayrollItem;
  orgHash: string;
  canAdjust: boolean;
  onAdjusted: () => void;
}) {
  const { mutate: addAdjustment, loading } = useCreatePayrollAdjustment();
  const { success, error: showError } = useNotification();
  const [type, setType] = useState<"bonus" | "deduction">("bonus");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseAmount(amount);
    if (!amt || amt <= 0) {
      setErr("Nhập số tiền hợp lệ.");
      return;
    }
    setErr("");
    const payload: CreateAdjustmentPayload = {
      type,
      amount: amt,
      reason: reason.trim() || undefined,
    };
    const res = await addAdjustment(orgHash, item.id, payload);
    if (res.success) {
      success("Đã thêm điều chỉnh");
      setAmount("");
      setReason("");
      onAdjusted();
    } else {
      showError(extractErrorMessage(res, "Không thể thêm điều chỉnh."));
    }
  };

  return (
    <div className="space-y-3">
      {item.breakdown && item.breakdown.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-gray-400">
            Chi tiết tính lương
          </p>
          <ul className="space-y-1 text-sm">
            {item.breakdown.map((b, i) => (
              <li key={i} className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  {b.label}
                </span>
                {/* text dành cho dòng không phải tiền (số buổi, tỷ lệ %, kỳ tính) —
                    đổ qua money() sẽ ra "35 đ" cho tỷ lệ 35%. */}
                <span>{b.text ?? money(b.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {item.adjustments && item.adjustments.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-gray-400">
            Điều chỉnh
          </p>
          <ul className="space-y-1 text-sm">
            {item.adjustments.map((a) => (
              <li key={a.id} className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  {a.type === "bonus" ? "Thưởng" : "Khấu trừ"}
                  {a.reason ? ` · ${a.reason}` : ""}
                </span>
                <span
                  className={amountColor(
                    a.type === "bonus" ? a.amount : -a.amount,
                  )}
                >
                  {signedMoney(a.type === "bonus" ? a.amount : -a.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {canAdjust && (
        <form
          onSubmit={submit}
          className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end"
        >
          <SelectInput
            label="Loại"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as "bonus" | "deduction")}
            options={[
              { value: "bonus", label: "Thưởng" },
              { value: "deduction", label: "Khấu trừ" },
            ]}
            searchable={false}
          />
          <InputGroup
            label="Số tiền (đ)"
            name="amount"
            type="text"
            value={amount}
            handleChange={(e) => setAmount(formatAmount(e.target.value))}
            placeholder="VD: 500.000"
          />
          <InputGroup
            label="Lý do (tuỳ chọn)"
            name="reason"
            type="text"
            value={reason}
            handleChange={(e) => setReason(e.target.value)}
            placeholder="VD: Thưởng chuyên cần"
          />
          <Button
            type="submit"
            icon={<PlusIcon />}
            loading={loading}
            disabled={loading}
          >
            Thêm
          </Button>
        </form>
      )}
      {err && <p className="text-sm text-red-500">{err}</p>}
    </div>
  );
}
