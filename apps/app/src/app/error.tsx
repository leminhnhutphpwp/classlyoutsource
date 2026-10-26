"use client";

import { useEffect } from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to the console for debugging / observability.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center py-16 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/10">
        <ExclamationTriangleIcon className="h-8 w-8 text-red-600 dark:text-red-400" />
      </div>
      <h1 className="text-2xl font-bold text-dark dark:text-white sm:text-3xl">
        Đã có lỗi xảy ra
      </h1>
      <p className="mt-2 text-dark-4 dark:text-dark-6">
        Rất tiếc, đã có sự cố khi tải trang này. Bạn có thể thử lại hoặc quay về
        trang chủ.
      </p>
      {error?.digest && (
        <p className="mt-2 text-xs text-dark-5 dark:text-dark-6">
          Mã lỗi: {error.digest}
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex rounded-lg bg-primary px-4 py-2 font-medium text-white transition-colors hover:bg-primary/90 focus:outline-none focus:ring-1 focus:ring-primary focus:ring-offset-1"
        >
          Thử lại
        </button>
        {/* Cố ý dùng <a> (không phải next/link): trang đang ở trạng thái lỗi,
            một hard navigation reset toàn bộ cây React/state hỏng — đó chính là
            mục đích của link phục hồi lỗi. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/"
          className="inline-flex rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Về trang chủ
        </a>
      </div>
    </div>
  );
}
