"use client";

import DownloadButton from "@/components/Common/DownloadButton";
import ErrorDisplay from "@/components/Common/ErrorDisplay";
import { StatsCardSkeleton, TableSkeleton } from "@/components/ui/loading";
import {
  useFinancePnl,
  useFinanceCashflow,
  useFinanceTutorProfitability,
  useFinancePayables,
  useFinanceReceivables,
  financeExportUrl,
} from "@/hooks/use-api";
import { RoleBadge } from "./org-ui";
import { StatCard, Panel, EmptyRow, TableHead } from "./finance-ui";
import {
  money,
  signedMoney,
  amountColor,
  num,
  percent,
  monthLabel,
} from "./finance-format";
import type { OrgRole } from "@/types/organization";
import type {
  ReceivablesAgingBucket,
  ReceivablesReport,
} from "@/types/org-finance";

/** Nhãn tiếng Việt cho các khoá nhóm tuổi nợ backend sinh ra (current, d1_30, ...). */
const AGING_LABELS: Record<string, string> = {
  current: "Chưa đến hạn",
  d1_30: "Quá hạn 1–30 ngày",
  d31_60: "Quá hạn 31–60 ngày",
  d61_90: "Quá hạn 61–90 ngày",
  d90_plus: "Quá hạn trên 90 ngày",
};

/**
 * Chuẩn hoá `aging` về mảng để render.
 *
 * Backend trả về MỘT OBJECT khoá-theo-nhóm ({current: 0, d1_30: 31900000, ...}). Code cũ
 * khai nó là mảng rồi gọi thẳng .map() — object không có .map nên ném TypeError, và vì
 * đây là lỗi lúc render nên error boundary nuốt trọn trang tài chính chứ không chỉ hỏng
 * một bảng. `?? []` không cứu được: nó chỉ chặn null/undefined, không chặn sai kiểu.
 *
 * Vẫn nhận cả dạng mảng để phòng backend đổi hợp đồng sau này.
 * Số khoản mỗi nhóm đếm từ `requests[].aging_bucket` — trước đây cột đó luôn hiện "—".
 */
function agingBuckets(
  data?: ReceivablesReport | null,
): ReceivablesAgingBucket[] {
  const raw = data?.aging;
  if (Array.isArray(raw)) return raw as ReceivablesAgingBucket[];
  if (!raw || typeof raw !== "object") return [];

  const counts = new Map<string, number>();
  for (const r of data?.requests ?? []) {
    if (r?.aging_bucket) {
      counts.set(r.aging_bucket, (counts.get(r.aging_bucket) ?? 0) + 1);
    }
  }

  return Object.entries(raw).map(([bucket, amount]) => ({
    bucket,
    amount: Number(amount) || 0,
    count: counts.get(bucket) ?? 0,
  }));
}

interface RangeProps {
  dateFrom: string;
  dateTo: string;
}

function ExportCsvButton({
  report,
  dateFrom,
  dateTo,
}: {
  report: "pnl" | "tutor-profitability" | "cashflow" | "payables";
  dateFrom: string;
  dateTo: string;
}) {
  return (
    <DownloadButton
      url={financeExportUrl(report, dateFrom, dateTo)}
      filename={`${report}.csv`}
      variant="secondary"
      size="md"
    >
      Xuất CSV
    </DownloadButton>
  );
}

function StatsRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:gap-5 xl:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <StatsCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ---- P&L -------------------------------------------------------------------
export function PnlSection({ dateFrom, dateTo }: RangeProps) {
  const { data, loading, error, refetch } = useFinancePnl(dateFrom, dateTo);

  if (error && !loading) {
    return (
      <ErrorDisplay
        title="Không tải được báo cáo lãi/lỗ"
        error={error}
        onRetry={() => refetch()}
      />
    );
  }

  const s = data?.summary;
  const byMonth = data?.by_month ?? [];
  const byCategory = data?.expenses_by_category ?? [];

  return (
    <div className="space-y-4 sm:space-y-6">
      {loading && !data ? (
        <StatsRowSkeleton count={5} />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:gap-5 xl:grid-cols-5">
          <StatCard label="Doanh thu" value={money(s?.total_revenue)} />
          <StatCard label="Chi phí" value={money(s?.total_expenses)} />
          <StatCard label="Chi phí giáo viên" value={money(s?.tutor_cost)} />
          <StatCard
            label="Lợi nhuận ròng"
            value={signedMoney(s?.net_profit)}
            valueClass={amountColor(s?.net_profit)}
          />
          <StatCard label="Biên lợi nhuận" value={percent(s?.margin_pct)} />
        </div>
      )}

      {data && !data.payroll_available && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          Chưa có dữ liệu bảng lương — chi phí giáo viên đang ước tính hoặc bằng
          0.
        </p>
      )}

      <Panel
        title="Lãi/lỗ theo tháng"
        subtitle="Doanh thu, chi phí và lợi nhuận từng tháng trong khoảng đã chọn"
        action={
          <ExportCsvButton report="pnl" dateFrom={dateFrom} dateTo={dateTo} />
        }
      >
        {loading && !data ? (
          <div className="p-4 sm:p-6">
            <TableSkeleton rows={4} cols={5} />
          </div>
        ) : byMonth.length === 0 ? (
          <EmptyRow message="Chưa có dữ liệu trong khoảng thời gian này." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <TableHead>
                <tr>
                  <th className="px-4 py-3 sm:px-6">Tháng</th>
                  <th className="px-4 py-3 text-right">Doanh thu</th>
                  <th className="px-4 py-3 text-right">Chi phí</th>
                  <th className="px-4 py-3 text-right">Lợi nhuận</th>
                  <th className="px-4 py-3 text-right sm:px-6">Biên LN</th>
                </tr>
              </TableHead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {byMonth.map((r) => (
                  <tr
                    key={r.month}
                    className="text-gray-900 dark:text-gray-200"
                  >
                    <td className="px-4 py-3 font-medium sm:px-6">
                      {monthLabel(r.month)}
                    </td>
                    <td className="px-4 py-3 text-right">{money(r.revenue)}</td>
                    <td className="px-4 py-3 text-right">
                      {money(r.expenses)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right ${amountColor(r.net_profit)}`}
                    >
                      {signedMoney(r.net_profit)}
                    </td>
                    <td className="px-4 py-3 text-right sm:px-6">
                      {percent(r.margin_pct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {byCategory.length > 0 && (
        <Panel
          title="Chi phí theo hạng mục"
          subtitle="Cơ cấu chi phí trong khoảng thời gian"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[360px] text-left text-sm">
              <TableHead>
                <tr>
                  <th className="px-4 py-3 sm:px-6">Hạng mục</th>
                  <th className="px-4 py-3 text-right sm:px-6">Tổng</th>
                </tr>
              </TableHead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {byCategory.map((c) => (
                  <tr
                    key={c.category}
                    className="text-gray-900 dark:text-gray-200"
                  >
                    <td className="px-4 py-3 sm:px-6">
                      {EXPENSE_CATEGORY_LABELS[c.category] ?? c.category}
                    </td>
                    <td className="px-4 py-3 text-right sm:px-6">
                      {money(c.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}

// ---- Cashflow --------------------------------------------------------------
export function CashflowSection({ dateFrom, dateTo }: RangeProps) {
  const { data, loading, error, refetch } = useFinanceCashflow(
    dateFrom,
    dateTo,
  );

  if (error && !loading) {
    return (
      <ErrorDisplay
        title="Không tải được dòng tiền"
        error={error}
        onRetry={() => refetch()}
      />
    );
  }
  const s = data?.summary;
  const rows = data?.by_month ?? [];

  return (
    <div className="space-y-4 sm:space-y-6">
      {loading && !data ? (
        <StatsRowSkeleton count={5} />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:gap-5 xl:grid-cols-5">
          <StatCard
            label="Tiền vào"
            value={money(s?.total_in)}
            valueClass="text-green-600 dark:text-green-400"
          />
          <StatCard
            label="Tiền ra"
            value={money(s?.total_out)}
            valueClass="text-red-600 dark:text-red-400"
          />
          <StatCard label="Chi phí" value={money(s?.expense_out)} />
          <StatCard label="Trả lương" value={money(s?.payroll_out)} />
          <StatCard
            label="Dòng tiền ròng"
            value={signedMoney(s?.net_flow)}
            valueClass={amountColor(s?.net_flow)}
          />
        </div>
      )}

      <Panel
        title="Dòng tiền theo tháng"
        action={
          <ExportCsvButton
            report="cashflow"
            dateFrom={dateFrom}
            dateTo={dateTo}
          />
        }
      >
        {loading && !data ? (
          <div className="p-4 sm:p-6">
            <TableSkeleton rows={4} cols={6} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyRow message="Chưa có dữ liệu dòng tiền." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <TableHead>
                <tr>
                  <th className="px-4 py-3 sm:px-6">Tháng</th>
                  <th className="px-4 py-3 text-right">Tiền vào</th>
                  <th className="px-4 py-3 text-right">Tiền ra</th>
                  <th className="px-4 py-3 text-right">Chi phí</th>
                  <th className="px-4 py-3 text-right">Trả lương</th>
                  <th className="px-4 py-3 text-right sm:px-6">Ròng</th>
                </tr>
              </TableHead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {rows.map((r) => (
                  <tr
                    key={r.month}
                    className="text-gray-900 dark:text-gray-200"
                  >
                    <td className="px-4 py-3 font-medium sm:px-6">
                      {monthLabel(r.month)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {money(r.money_in)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {money(r.money_out)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {money(r.expense_out)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {money(r.payroll_out)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right sm:px-6 ${amountColor(r.net_flow)}`}
                    >
                      {signedMoney(r.net_flow)}
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

// ---- Tutor profitability ---------------------------------------------------
export function TutorProfitabilitySection({ dateFrom, dateTo }: RangeProps) {
  const { data, loading, error, refetch } = useFinanceTutorProfitability(
    dateFrom,
    dateTo,
  );

  if (error && !loading) {
    return (
      <ErrorDisplay
        title="Không tải được lợi nhuận theo giáo viên"
        error={error}
        onRetry={() => refetch()}
      />
    );
  }
  const tutors = data?.tutors ?? [];

  return (
    <Panel
      title="Lợi nhuận theo giáo viên"
      subtitle="Doanh thu, chi phí lương và lợi nhuận đóng góp của từng giáo viên"
      action={
        <ExportCsvButton
          report="tutor-profitability"
          dateFrom={dateFrom}
          dateTo={dateTo}
        />
      }
    >
      {loading && !data ? (
        <div className="p-4 sm:p-6">
          <TableSkeleton rows={5} cols={6} />
        </div>
      ) : tutors.length === 0 ? (
        <EmptyRow message="Chưa có dữ liệu giáo viên." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <TableHead>
              <tr>
                <th className="px-4 py-3 sm:px-6">Giáo viên</th>
                <th className="px-4 py-3">Vai trò</th>
                <th className="px-4 py-3 text-right">Doanh thu</th>
                <th className="px-4 py-3 text-right">Chi phí lương</th>
                <th className="px-4 py-3 text-right">CP phân bổ</th>
                <th className="px-4 py-3 text-right">Lợi nhuận</th>
                <th className="px-4 py-3 text-right sm:px-6">Biên LN</th>
              </tr>
            </TableHead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {tutors.map((t) => (
                <tr
                  key={t.tutor_id}
                  className="text-gray-900 dark:text-gray-200"
                >
                  <td className="px-4 py-3 font-medium sm:px-6">
                    {t.tutor_name || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {t.org_role ? (
                      <RoleBadge role={t.org_role as OrgRole} />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">{money(t.revenue)}</td>
                  <td className="px-4 py-3 text-right">
                    {money(t.payroll_cost)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {money(t.attributed_expenses)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right ${amountColor(t.margin)}`}
                  >
                    {signedMoney(t.margin)}
                  </td>
                  <td className="px-4 py-3 text-right sm:px-6">
                    {percent(t.margin_pct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

// ---- Payables --------------------------------------------------------------
export function PayablesSection({ dateFrom, dateTo }: RangeProps) {
  const { data, loading, error, refetch } = useFinancePayables(
    dateFrom,
    dateTo,
  );

  if (error && !loading) {
    return (
      <ErrorDisplay
        title="Không tải được công nợ phải trả"
        error={error}
        onRetry={() => refetch()}
      />
    );
  }
  const s = data?.summary;
  const payroll = data?.payroll ?? [];
  const expenses = data?.expenses ?? [];

  return (
    <div className="space-y-4 sm:space-y-6">
      {loading && !data ? (
        <StatsRowSkeleton count={3} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 md:gap-5">
          <StatCard
            label="Tổng phải trả"
            value={money(s?.total_payable)}
            valueClass="text-red-600 dark:text-red-400"
          />
          <StatCard label="Lương chưa trả" value={money(s?.payroll_payable)} />
          <StatCard
            label="Chi phí chưa chi"
            value={money(s?.expense_payable)}
          />
        </div>
      )}

      <Panel
        title="Chi tiết phải trả"
        action={
          <ExportCsvButton
            report="payables"
            dateFrom={dateFrom}
            dateTo={dateTo}
          />
        }
      >
        {loading && !data ? (
          <div className="p-4 sm:p-6">
            <TableSkeleton rows={4} cols={3} />
          </div>
        ) : payroll.length === 0 && expenses.length === 0 ? (
          <EmptyRow message="Không có khoản phải trả nào." />
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {payroll.length > 0 && (
              <div className="overflow-x-auto">
                <p className="px-4 pt-4 text-xs font-semibold uppercase text-gray-400 sm:px-6">
                  Lương chưa trả
                </p>
                <table className="w-full min-w-[360px] text-left text-sm">
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {payroll.map((p) => (
                      <tr
                        key={p.tutor_id}
                        className="text-gray-900 dark:text-gray-200"
                      >
                        <td className="px-4 py-3 sm:px-6">{p.tutor_name}</td>
                        <td className="px-4 py-3 text-right sm:px-6">
                          {money(p.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {expenses.length > 0 && (
              <div className="overflow-x-auto">
                <p className="px-4 pt-4 text-xs font-semibold uppercase text-gray-400 sm:px-6">
                  Chi phí chưa chi
                </p>
                <table className="w-full min-w-[520px] text-left text-sm">
                  <TableHead>
                    <tr>
                      <th className="px-4 py-3 sm:px-6">Hạng mục</th>
                      <th className="px-4 py-3">Ngày</th>
                      <th className="px-4 py-3">Mô tả</th>
                      <th className="px-4 py-3 text-right sm:px-6">Số tiền</th>
                    </tr>
                  </TableHead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {expenses.map((e) => (
                      <tr
                        key={e.id}
                        className="text-gray-900 dark:text-gray-200"
                      >
                        <td className="px-4 py-3 sm:px-6">
                          {EXPENSE_CATEGORY_LABELS[e.category] ?? e.category}
                        </td>
                        <td className="px-4 py-3">{e.expense_date ?? "—"}</td>
                        <td className="px-4 py-3">{e.description || "—"}</td>
                        <td className="px-4 py-3 text-right sm:px-6">
                          {money(e.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}

// ---- Receivables (Wave 2, aged buckets) ------------------------------------
export function ReceivablesSection({ dateFrom, dateTo }: RangeProps) {
  const { data, loading, error, refetch } = useFinanceReceivables(
    dateFrom,
    dateTo,
  );

  if (error && !loading) {
    return (
      <ErrorDisplay
        title="Không tải được công nợ phải thu"
        error={error}
        onRetry={() => refetch()}
      />
    );
  }
  const buckets = agingBuckets(data);
  const total = data?.summary?.total_outstanding;
  const openRequests = data?.summary?.open_requests;

  return (
    <div className="space-y-4 sm:space-y-6">
      {loading && !data ? (
        <StatsRowSkeleton count={2} />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:gap-5">
          <StatCard
            label="Tổng phải thu"
            value={money(total)}
            valueClass="text-green-600 dark:text-green-400"
          />
          {/* Số nhóm tuổi nợ luôn là 5 (backend trả đủ mọi nhóm kể cả nhóm rỗng) nên
              không nói lên điều gì. Số khoản đang mở mới là con số dùng được. */}
          <StatCard label="Số khoản đang mở" value={num(openRequests)} />
        </div>
      )}

      <Panel title="Phải thu theo tuổi nợ">
        {loading && !data ? (
          <div className="p-4 sm:p-6">
            <TableSkeleton rows={4} cols={3} />
          </div>
        ) : buckets.length === 0 ? (
          <EmptyRow message="Không có khoản phải thu nào." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[360px] text-left text-sm">
              <TableHead>
                <tr>
                  <th className="px-4 py-3 sm:px-6">Nhóm tuổi nợ</th>
                  <th className="px-4 py-3 text-right">Số khoản</th>
                  <th className="px-4 py-3 text-right sm:px-6">Số tiền</th>
                </tr>
              </TableHead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {buckets.map((b, i) => (
                  <tr
                    key={b.bucket ?? i}
                    className="text-gray-900 dark:text-gray-200"
                  >
                    <td className="px-4 py-3 font-medium sm:px-6">
                      {AGING_LABELS[b.bucket] ?? b.bucket}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {b.count !== undefined ? num(b.count) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right sm:px-6">
                      {money(b.amount)}
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

// Nhãn hạng mục chi phí (dùng chung với màn hình Chi phí).
export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  rent: "Thuê mặt bằng",
  utilities: "Điện nước",
  salary: "Lương/nhân sự",
  marketing: "Marketing",
  equipment: "Thiết bị",
  supplies: "Vật tư",
  maintenance: "Bảo trì",
  software: "Phần mềm",
  tax: "Thuế/phí",
  other: "Khác",
};
