"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeftIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import ButtonLink from "@/components/Common/ButtonLink";
import Button from "@/components/Common/Button";
import ConfirmDeleteDialog from "@/components/Common/ConfirmDeleteDialog";
import { Tabs } from "@/components/Common/Tabs";
import { TableSkeleton } from "@/components/ui/loading";
import ErrorDisplay from "@/components/Common/ErrorDisplay";
import { useOrganizationContext } from "@/contexts/organization-context";
import { useNotification } from "@/hooks/use-notification";
import { extractErrorMessage, extractFieldErrors } from "@/lib/api-error-utils";
import {
  useOrgExpenses,
  useCreateOrgExpense,
  useUpdateOrgExpense,
  useDeleteOrgExpense,
} from "@/hooks/use-api";
import { OrgFeatureGuard } from "../../_components/org-guard";
import { Panel, EmptyRow, TableHead } from "../../_components/finance-ui";
import { EXPENSE_CATEGORY_LABELS } from "../../_components/finance-sections";
import { money } from "../../_components/finance-format";
import { ExpenseForm } from "../../_components/expense-form";
import type { OrgExpense } from "@/types/org-finance";

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Tiền mặt",
  bank_transfer: "Chuyển khoản",
  card: "Thẻ",
  ewallet: "Ví điện tử",
  other: "Khác",
};

const CATEGORY_FILTER_TABS = [
  { id: "", label: "Tất cả" },
  ...Object.entries(EXPENSE_CATEGORY_LABELS).map(([id, label]) => ({
    id,
    label,
  })),
];

export default function OrganizationExpensesPage() {
  const { canViewFinance, organization } = useOrganizationContext();
  const orgHash = organization?.id;

  const [category, setCategory] = useState("");
  const filters = useMemo(
    () => ({ category: category || undefined }),
    [category],
  );

  const {
    data: expenses,
    loading,
    error,
    refetch,
  } = useOrgExpenses(orgHash, filters);
  const { mutate: createExpense, loading: creating } = useCreateOrgExpense();
  const { mutate: updateExpense, loading: updating } = useUpdateOrgExpense();
  const { mutate: deleteExpense, loading: deleting } = useDeleteOrgExpense();
  const { success, error: showError } = useNotification();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<OrgExpense | null>(null);
  const [target, setTarget] = useState<OrgExpense | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const list = expenses ?? [];

  const openCreate = () => {
    setEditing(null);
    setFieldErrors({});
    setFormOpen(true);
  };
  const openEdit = (e: OrgExpense) => {
    setEditing(e);
    setFieldErrors({});
    setFormOpen(true);
  };

  const handleSubmit = async (payload: Parameters<typeof createExpense>[1]) => {
    if (!orgHash) return;
    setFieldErrors({});
    const res = editing
      ? await updateExpense(orgHash, editing.id, payload)
      : await createExpense(orgHash, payload);
    if (res.success) {
      success(editing ? "Đã cập nhật chi phí" : "Đã thêm chi phí");
      setFormOpen(false);
      setEditing(null);
      refetch();
      return;
    }
    const fErrs = extractFieldErrors(res);
    if (Object.keys(fErrs).length > 0) {
      setFieldErrors(fErrs);
    } else {
      showError(
        extractErrorMessage(res, "Không thể lưu chi phí. Vui lòng thử lại."),
      );
    }
  };

  const handleDelete = async () => {
    if (!orgHash || !target) return;
    const res = await deleteExpense(orgHash, target.id);
    if (res.success) {
      success("Đã xóa chi phí");
      setTarget(null);
      refetch();
    } else {
      showError(extractErrorMessage(res, "Không thể xóa chi phí."));
    }
  };

  return (
    <OrgFeatureGuard allowed={canViewFinance}>
      <div className="space-y-4 sm:space-y-6">
        <ConfirmDeleteDialog
          open={!!target}
          onClose={() => setTarget(null)}
          onConfirm={handleDelete}
          loading={deleting}
          label="Xóa chi phí"
          message={
            target
              ? `Bạn có chắc muốn xóa khoản chi phí ${money(target.amount)} (${
                  EXPENSE_CATEGORY_LABELS[target.category] ?? target.category
                })?`
              : ""
          }
        />

        {/* ExpenseForm tự dựng lớp phủ qua portal nên vị trí ở đây không ảnh hưởng bố cục.
            `key` là bắt buộc: các trường trong form khởi tạo state từ prop `expense` bằng
            useState, mà hàm khởi tạo chỉ chạy lúc mount. Không có key thì mở "Sửa" bản ghi
            khác trong lúc form đang mở sẽ giữ nguyên dữ liệu cũ trên màn hình nhưng lưu
            vào bản ghi mới. */}
        {formOpen && orgHash && (
          <ExpenseForm
            key={editing?.id ?? "new"}
            expense={editing}
            saving={creating || updating}
            fieldErrors={fieldErrors}
            onCancel={() => {
              setFormOpen(false);
              setEditing(null);
            }}
            onSubmit={handleSubmit}
          />
        )}

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <ButtonLink
            href="/organization/finance"
            variant="outline"
            size="sm"
            icon={<ArrowLeftIcon />}
            className="w-full justify-center sm:w-auto"
            lockAware={false}
          >
            Quay lại
          </ButtonLink>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-dark dark:text-white sm:text-2xl">
              Chi phí
            </h1>
            <p className="mt-1 text-dark-4 dark:text-dark-6">
              Ghi nhận và quản lý chi phí của trung tâm
            </p>
          </div>
          <Button icon={<PlusIcon />} onClick={openCreate} className="shrink-0">
            Thêm chi phí
          </Button>
        </div>

        <Tabs
          tabs={CATEGORY_FILTER_TABS}
          activeTab={category}
          onChange={setCategory}
        />

        {error && !loading ? (
          <ErrorDisplay
            title="Không tải được danh sách chi phí"
            error={error}
            onRetry={() => refetch()}
          />
        ) : (
          <Panel
            title="Danh sách chi phí"
            subtitle={`${list.length} khoản chi phí`}
          >
            {loading && list.length === 0 ? (
              <div className="p-4 sm:p-6">
                <TableSkeleton rows={5} cols={5} />
              </div>
            ) : list.length === 0 ? (
              <EmptyRow message="Chưa có chi phí nào. Hãy thêm khoản chi phí đầu tiên." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <TableHead>
                    <tr>
                      <th className="px-4 py-3 sm:px-6">Hạng mục</th>
                      <th className="px-4 py-3">Ngày</th>
                      <th className="px-4 py-3">Mô tả</th>
                      <th className="px-4 py-3">Thanh toán</th>
                      <th className="px-4 py-3 text-right">Số tiền</th>
                      <th className="px-4 py-3 text-right sm:px-6">Thao tác</th>
                    </tr>
                  </TableHead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {list.map((e) => (
                      <tr
                        key={e.id}
                        className="text-gray-900 dark:text-gray-200"
                      >
                        <td className="px-4 py-3 font-medium sm:px-6">
                          {EXPENSE_CATEGORY_LABELS[e.category] ?? e.category}
                        </td>
                        <td className="px-4 py-3">{e.expense_date || "—"}</td>
                        <td className="max-w-[220px] truncate px-4 py-3">
                          {e.description || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {e.payment_method ? (
                            (PAYMENT_LABELS[e.payment_method] ??
                            e.payment_method)
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                              Chưa chi
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {money(e.amount)}
                        </td>
                        <td className="px-4 py-3 text-right sm:px-6">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              icon={<PencilSquareIcon />}
                              onClick={() => openEdit(e)}
                              aria-label="Sửa"
                            >
                              Sửa
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              icon={<TrashIcon />}
                              onClick={() => setTarget(e)}
                              aria-label="Xóa"
                            >
                              Xóa
                            </Button>
                          </div>
                        </td>
                      </tr>
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
