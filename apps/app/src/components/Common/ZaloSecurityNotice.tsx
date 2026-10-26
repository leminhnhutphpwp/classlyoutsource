"use client";
import { useEffect, useState } from "react";
import { ShieldCheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { isZaloApp } from "@/lib/zalo-utils";

export default function ZaloSecurityNotice() {
  const [isZalo, setIsZalo] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setIsZalo(isZaloApp());
    
    // Check if user has dismissed this notice before
    const dismissed = localStorage.getItem('zalo-security-notice-dismissed');
    if (dismissed === 'true') {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('zalo-security-notice-dismissed', 'true');
  };

  if (!isZalo || dismissed) {
    return null;
  }

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 dark:bg-green-900/20 dark:border-green-800">
      <div className="flex items-start gap-3">
        <ShieldCheckIcon className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">
            Ứng dụng an toàn và bảo mật
          </h3>
          <div className="text-sm text-green-700 dark:text-green-300 space-y-1">
            <p>Kết nối được mã hóa SSL/TLS</p>
            <p>Dữ liệu được bảo vệ theo tiêu chuẩn quốc tế</p>
            <p>Tuân thủ chính sách bảo mật của Zalo</p>
            <p className="text-xs opacity-75 mt-2">
              Nếu Zalo hiển thị cảnh báo bảo mật, bạn có thể an tâm tiếp tục sử dụng.
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-green-400 hover:text-green-600 dark:text-green-500 dark:hover:text-green-300 flex-shrink-0"
          title="Đóng thông báo"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}