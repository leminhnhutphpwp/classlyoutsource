"use client";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface ConfirmGenerateSessionsDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  scheduleName?: string;
}

export default function ConfirmGenerateSessionsDialog({
  open,
  onClose,
  onConfirm,
  loading = false,
  scheduleName,
}: ConfirmGenerateSessionsDialogProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!open || !mounted) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow || "";
      document.documentElement.style.overflow = previousHtmlOverflow || "";
    };
  }, [open, mounted]);

  if (!open || !mounted) return null;

  const modalContent = (
    <div
      className="fixed inset-0 flex items-center justify-center z-[1000] bg-black/50 backdrop-blur-[1px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-generate-sessions-title"
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full mx-4 p-6 shadow-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          <span id="confirm-generate-sessions-title">Xác nhận tạo buổi học</span>
        </h3>
        <div className="mb-6">
          <p className="text-gray-700 dark:text-gray-300 mb-2">
            Bạn có chắc muốn tạo buổi học từ lịch học này?
          </p>
          {scheduleName && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <strong>Lịch học:</strong> {scheduleName}
            </p>
          )}
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Hệ thống sẽ tự động tạo các buổi học dựa trên cấu hình lịch học của bạn (tần suất, thứ trong tuần, ngày bắt đầu/kết thúc).
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-3 italic">
            Lưu ý: Chỉ tạo các buổi học chưa tồn tại, các buổi học đã có sẽ được giữ nguyên.
          </p>
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
            disabled={loading}
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Đang tạo...</span>
              </>
            ) : (
              "Xác nhận tạo"
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

