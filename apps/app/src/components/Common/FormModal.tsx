"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon } from "@heroicons/react/24/outline";

/**
 * Lớp phủ dùng chung cho các form thêm/sửa.
 *
 * Hệ thống quy ước mọi thao tác thêm/sửa đều mở hộp thoại (xem ConfirmDeleteDialog,
 * RemoveMemberDialog, RoleChangeDialog). Trước đây vài form ở trang trung tâm lại chèn
 * thẳng vào đầu trang: nội dung bị đẩy xuống, bảng dữ liệu mất khỏi tầm mắt đúng lúc
 * người dùng cần đối chiếu, và trên màn hình nhỏ thì form nằm ngoài vùng nhìn nên bấm
 * "Thêm" trông như không có gì xảy ra.
 *
 * Component này chỉ lo phần vỏ. Nội dung bên trong (thường là <form>) do phía gọi truyền
 * vào qua children, nên mỗi form giữ nguyên logic riêng của nó.
 */
export default function FormModal({
  title,
  onClose,
  children,
  size = "lg",
  closeDisabled = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** lg vừa cho form 2 cột; md cho form ngắn 1 cột. */
  size?: "md" | "lg";
  /** Chặn đóng khi đang lưu, tránh người dùng bỏ đi giữa chừng một request đang bay. */
  closeDisabled?: boolean;
}) {
  // Khoá cuộn nền. Deps PHẢI rỗng: nếu gộp với effect bàn phím bên dưới thì `onClose`
  // (thường là arrow inline, đổi mỗi lần render) sẽ khiến effect chạy lại, lần thứ hai
  // đọc được prevBody = "hidden" và lúc đóng modal khôi phục đúng giá trị đó — trang
  // sẽ không cuộn được nữa.
  useEffect(() => {
    const prevBody = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody || "";
    };
  }, []);

  // Esc để đóng. CỐ Ý không đóng khi bấm ra nền: khác với hộp xác nhận, form đang giữ dữ
  // liệu người dùng nhập dở và một cú bấm trượt làm mất hết là cái giá quá đắt.
  useEffect(() => {
    if (closeDisabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, closeDisabled]);

  const titleId = `form-modal-${title.replace(/\s+/g, "-").toLowerCase()}`;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {/* max-h + overflow-y: form nhiều trường cao hơn hẳn một hộp xác nhận, trên màn hình
          thấp mà không cho cuộn thì nút Lưu bị đẩy ra khỏi khung. */}
      <div
        className={`max-h-[90vh] w-full overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800 sm:p-6 ${
          size === "lg" ? "max-w-2xl" : "max-w-md"
        }`}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h3
            id={titleId}
            className="text-base font-semibold text-dark dark:text-white sm:text-lg"
          >
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label="Đóng"
            className="-mr-1 -mt-1 rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {children}
      </div>
    </div>,
    document.body,
  );
}
