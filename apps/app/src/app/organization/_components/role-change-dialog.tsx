"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Button from "@/components/Common/Button";
import SelectInput from "@/components/FormElements/SelectInput";
import type { OrgMember, OrgRole } from "@/types/organization";

type ChangeableRole = Extract<OrgRole, "tutor" | "manager" | "accountant">;

const ROLE_OPTIONS: { value: ChangeableRole; label: string }[] = [
  { value: "tutor", label: "Giáo viên" },
  { value: "manager", label: "Quản lý" },
  { value: "accountant", label: "Kế toán" },
];

/** Hộp thoại đổi vai trò thành viên (chỉ chủ trung tâm). */
export function RoleChangeDialog({
  open,
  member,
  loading,
  onClose,
  onConfirm,
}: {
  open: boolean;
  member: OrgMember | null;
  loading: boolean;
  onClose: () => void;
  onConfirm: (role: ChangeableRole) => void;
}) {
  const [role, setRole] = useState<ChangeableRole>("tutor");

  useEffect(() => {
    if (member && member.org_role !== "owner") {
      setRole(member.org_role as ChangeableRole);
    }
  }, [member]);

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev || "";
      };
    }
  }, [open]);

  if (!open || !member) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800 sm:p-6">
        <h3 className="mb-1 text-base font-semibold text-gray-900 dark:text-white sm:text-lg">
          Đổi vai trò
        </h3>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
          Chọn vai trò mới cho <span className="font-medium">{member.name}</span>.
        </p>

        <SelectInput
          label="Vai trò"
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value as ChangeableRole)}
          options={ROLE_OPTIONS}
          searchable={false}
        />

        <div className="mt-5 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} lockAware={false} disabled={loading}>
            Hủy
          </Button>
          <Button onClick={() => onConfirm(role)} loading={loading} disabled={loading}>
            Lưu vai trò
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
