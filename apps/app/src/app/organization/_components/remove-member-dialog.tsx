"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import Button from "@/components/Common/Button";
import type { OrgMember } from "@/types/organization";

/**
 * Gỡ thành viên trong base core đơn trung tâm: tách khỏi trung tâm, thu hồi phiên
 * đăng nhập và tạm ngưng account. Có thể dùng Khôi phục thành viên khi tuyển lại.
 */
export function RemoveMemberDialog({
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
  onConfirm: () => void;
}) {

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
        <h3 className="mb-3 text-base font-semibold text-gray-900 dark:text-white sm:text-lg">
          Gỡ thành viên
        </h3>
        <p className="mb-4 text-sm text-gray-700 dark:text-gray-300">
          Bạn có chắc muốn gỡ <span className="font-medium">{member.name}</span> khỏi trung tâm?
          Tài khoản sẽ được tạm ngưng đăng nhập, còn lịch sử lớp học và lương vẫn được lưu.
          Có thể khôi phục thành viên khi tuyển lại.
        </p>

        <div className="mt-5 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} lockAware={false} disabled={loading}>
            Hủy
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            loading={loading}
            disabled={loading}
          >
            Gỡ thành viên
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
