"use client";
import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { useLockContext } from "@/contexts/lock-context";

interface ConfirmDeleteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  message?: string;
  label?: string;
}

export default function ConfirmDeleteDialog({
  open,
  onClose,
  onConfirm,
  loading = false,
  message = "Bạn có chắc muốn xóa mục này? Hành động này không thể hoàn tác!",
  label = "Xác nhận xóa",
}: ConfirmDeleteDialogProps) {
  const { actionsLocked } = useLockContext();
  const confirmDisabled = loading || actionsLocked;

  useEffect(() => {
    if (open) {
      const previousBodyOverflow = document.body.style.overflow;
      const previousHtmlOverflow = document.documentElement.style.overflow;
      
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      
      return () => {
        document.body.style.overflow = previousBodyOverflow || "";
        document.documentElement.style.overflow = previousHtmlOverflow || "";
      };
    }
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center z-[1000] bg-black/50 backdrop-blur-[1px] p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-delete-title">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-4 sm:p-6 shadow-lg border border-gray-200 dark:border-gray-700">
        <h3 id="confirm-delete-title" className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">Xác nhận xoá</h3>
        <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 mb-4">{message}</p>
        {actionsLocked && (
          <p className="mb-4 text-xs text-amber-600 dark:text-amber-300">
            Tài khoản của bạn đang bị tạm khóa thao tác, không thể thực hiện xoá lúc này.
          </p>
        )}
        <div className="flex flex-row justify-end gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-3 sm:px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 flex-1 sm:flex-none sm:w-auto"
            disabled={loading}
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="rounded-lg bg-red-600 px-3 sm:px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 flex-1 sm:flex-none sm:w-auto"
          >
            {loading ? "Đang xóa..." : label}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
