"use client";

import { useLockContext } from "@/contexts/lock-context";
import { LockClosedIcon } from "@heroicons/react/24/outline";

interface LockedContentProps {
  title: string;
  description?: string;
  defaultMessage?: string;
  className?: string;
}

export default function LockedContent({
  title,
  description,
  defaultMessage = "Trong thời gian khóa, bạn chỉ có thể xem mà không thể thực hiện các thao tác.",
  className: _className,
}: LockedContentProps) {
  const { actionsLocked, lockInfo } = useLockContext();

  // Hiển thị thông báo lock nếu có
  if (!actionsLocked) {
    return null;
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center py-12">
      <div className="w-full max-w-lg mx-auto px-4">
        <div className="rounded-2xl bg-white border border-gray-200 shadow-lg p-8 dark:bg-gray-800 dark:border-gray-700">
          <div className="text-center mb-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
              <LockClosedIcon className="w-8 h-8 text-gray-600 dark:text-gray-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{title}</h1>
            {description && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {description}
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {lockInfo?.code === 'ACCOUNT_INACTIVE' || lockInfo?.code === 'TUTOR_INACTIVE'
                  ? 'Tài khoản đã bị vô hiệu hóa'
                  : 'Tài khoản của bạn đang bị tạm khóa'}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                {lockInfo?.message || defaultMessage}
              </p>
            </div>

            {lockInfo?.reason && (
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  <span className="font-medium text-gray-900 dark:text-white">Lý do: </span>
                  {lockInfo.reason}
                </p>
              </div>
            )}

            {lockInfo?.locked_until && (
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  <span className="font-medium text-gray-900 dark:text-white">Dự kiến mở khóa: </span>
                  {new Date(lockInfo.locked_until).toLocaleString('vi-VN')}
                </p>
              </div>
            )}

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Bạn tạm thời không thể đăng nhập hoặc sử dụng các chức năng chính của hệ thống. Mọi
                thao tác tạo, sửa hoặc xóa dữ liệu sẽ bị chặn cho đến khi khóa được gỡ.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
