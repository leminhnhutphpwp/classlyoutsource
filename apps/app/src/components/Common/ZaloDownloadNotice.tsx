"use client";
import { useEffect, useState } from "react";
import { InformationCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { isZaloApp } from "@/lib/zalo-utils";

export default function ZaloDownloadNotice() {
  const [isZalo, setIsZalo] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setIsZalo(isZaloApp());
    
    // Check if user has dismissed this notice before
    const dismissed = localStorage.getItem('zalo-download-notice-dismissed');
    if (dismissed === 'true') {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('zalo-download-notice-dismissed', 'true');
  };

  if (!isZalo || dismissed) {
    return null;
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 dark:bg-blue-900/20 dark:border-blue-800">
      <div className="flex items-start gap-3">
        <InformationCircleIcon className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
            Hướng dẫn tải xuống trong Zalo
          </h3>
          <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
            <p>Để tải xuống file tốt nhất, vui lòng:</p>
            <ol className="list-decimal list-inside space-y-0.5 ml-2">
              <li>Nhấn vào nút <strong>&quot;⋯&quot;</strong> (3 chấm) ở góc trên bên phải</li>
              <li>Chọn <strong>&quot;Mở bằng trình duyệt&quot;</strong></li>
              <li>Thực hiện tải xuống trong trình duyệt</li>
            </ol>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-blue-400 hover:text-blue-600 dark:text-blue-500 dark:hover:text-blue-300 flex-shrink-0"
          title="Đóng thông báo"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}