"use client";

import { useState } from "react";
import InputGroup from "@/components/FormElements/InputGroup";
import SelectInput from "@/components/FormElements/SelectInput";
import Button from "@/components/Common/Button";
import FormModal from "@/components/Common/FormModal";
import { formatAmount, parseAmount } from "@/lib/format-currency";
import { useOrganizationContext } from "@/contexts/organization-context";
import { EXPENSE_CATEGORY_LABELS } from "./finance-sections";
import type { CreateExpensePayload, OrgExpense } from "@/types/org-finance";

const PAYMENT_OPTIONS = [
  { value: "", label: "Chưa chi (ghi công nợ)" },
  { value: "cash", label: "Tiền mặt" },
  { value: "bank_transfer", label: "Chuyển khoản" },
  { value: "card", label: "Thẻ" },
  { value: "ewallet", label: "Ví điện tử" },
  { value: "other", label: "Khác" },
];

const CATEGORY_OPTIONS = Object.entries(EXPENSE_CATEGORY_LABELS).map(
  ([value, label]) => ({
    value,
    label,
  }),
);

function localDateYmd(date = new Date()): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

/**
 * Form tạo/sửa chi phí, hiển thị dạng modal.
 *
 * Dùng portal + lớp phủ giống ConfirmDeleteDialog và RemoveMemberDialog để thống nhất
 * với phần còn lại của hệ thống: mọi thao tác thêm/sửa đều mở hộp thoại, không chèn
 * form vào đầu trang (kiểu cũ đẩy toàn bộ nội dung xuống và làm mất ngữ cảnh bảng).
 *
 * `payment_method` rỗng → gửi null (chưa chi → hiện ở công nợ).
 * Chỉ nhập `tutor_id` (tuỳ chọn) từ danh sách thành viên; class gắn qua backend khác.
 */
export function ExpenseForm({
  expense,
  saving,
  fieldErrors,
  onCancel,
  onSubmit,
}: {
  expense: OrgExpense | null;
  saving: boolean;
  fieldErrors: Record<string, string>;
  onCancel: () => void;
  onSubmit: (payload: CreateExpensePayload) => void;
}) {
  const { members } = useOrganizationContext();

  const [category, setCategory] = useState<string>(expense?.category ?? "rent");
  const [amount, setAmount] = useState<string>(
    expense?.amount ? formatAmount(expense.amount) : "",
  );
  const [expenseDate, setExpenseDate] = useState<string>(
    expense?.expense_date ?? localDateYmd(),
  );
  const [description, setDescription] = useState<string>(
    expense?.description ?? "",
  );
  const [paymentMethod, setPaymentMethod] = useState<string>(
    expense?.payment_method ?? "",
  );
  const [tutorId, setTutorId] = useState<string>(expense?.tutor_id ?? "");
  const [localErr, setLocalErr] = useState<string>("");

  const tutorOptions = [
    { value: "", label: "— Không gắn giáo viên —" },
    ...members
      .filter((m) => m.status !== "removed")
      .map((m) => ({ value: m.id, label: m.name })),
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseAmount(amount);
    if (!amt || amt <= 0) {
      setLocalErr("Vui lòng nhập số tiền hợp lệ.");
      return;
    }
    if (!expenseDate) {
      setLocalErr("Vui lòng chọn ngày chi.");
      return;
    }
    setLocalErr("");
    onSubmit({
      category,
      amount: amt,
      expense_date: expenseDate,
      description: description.trim() || undefined,
      payment_method: paymentMethod || null,
      tutor_id: tutorId || null,
    });
  };

  return (
    <FormModal
      title={expense ? "Sửa chi phí" : "Thêm chi phí"}
      onClose={onCancel}
      closeDisabled={saving}
    >
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectInput
            label="Hạng mục"
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={CATEGORY_OPTIONS}
            searchable={false}
            error={fieldErrors.category}
          />
          <InputGroup
            label="Số tiền (đ)"
            name="amount"
            type="text"
            required
            placeholder="VD: 5.000.000"
            value={amount}
            handleChange={(e) => setAmount(formatAmount(e.target.value))}
            error={fieldErrors.amount}
          />
          <InputGroup
            label="Ngày chi"
            name="expense_date"
            type="date"
            required
            value={expenseDate}
            handleChange={(e) => setExpenseDate(e.target.value)}
            error={fieldErrors.expense_date}
          />
          <SelectInput
            label="Phương thức thanh toán"
            name="payment_method"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            options={PAYMENT_OPTIONS}
            searchable={false}
            error={fieldErrors.payment_method}
          />
          <SelectInput
            label="Giáo viên (tuỳ chọn)"
            name="tutor_id"
            value={tutorId}
            onChange={(e) => setTutorId(e.target.value)}
            options={tutorOptions}
            error={fieldErrors.tutor_id}
          />
          <InputGroup
            label="Mô tả (tuỳ chọn)"
            name="description"
            type="text"
            placeholder="VD: Tiền thuê tháng 7"
            value={description}
            handleChange={(e) => setDescription(e.target.value)}
            error={fieldErrors.description}
          />
        </div>

        {localErr && <p className="mt-3 text-sm text-red-500">{localErr}</p>}

        <div className="mt-5 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            lockAware={false}
            disabled={saving}
          >
            Hủy
          </Button>
          <Button type="submit" loading={saving} disabled={saving}>
            {expense ? "Lưu thay đổi" : "Thêm chi phí"}
          </Button>
        </div>
      </form>
    </FormModal>
  );
}
