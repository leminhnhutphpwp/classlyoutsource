"use client";

import { useEffect } from "react";

/**
 * Last-resort error boundary. This replaces the root layout entirely, so the
 * app's global CSS is NOT guaranteed to be applied here — inline styles are
 * used to keep the fallback readable in every situation.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="vi">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f7f9fc",
          fontFamily:
            "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          color: "#111928",
        }}
      >
        <div style={{ maxWidth: 480, padding: 24, textAlign: "center" }}>
          <div
            style={{
              margin: "0 auto 24px",
              width: 64,
              height: 64,
              borderRadius: "9999px",
              backgroundColor: "#fde8e8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
            }}
          >
            ⚠️
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>
            Đã có lỗi nghiêm trọng
          </h1>
          <p style={{ marginTop: 8, color: "#637381" }}>
            Ứng dụng gặp sự cố không mong muốn. Vui lòng thử lại.
          </p>
          {error?.digest && (
            <p style={{ marginTop: 8, fontSize: 12, color: "#9ca3af" }}>
              Mã lỗi: {error.digest}
            </p>
          )}
          <div
            style={{
              marginTop: 24,
              display: "flex",
              gap: 12,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => reset()}
              style={{
                borderRadius: 8,
                backgroundColor: "#EF4444",
                color: "#ffffff",
                border: "none",
                padding: "10px 18px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Thử lại
            </button>
            {/* Cố ý dùng <a>: global-error thay thế root layout và render <html>
                riêng NGOÀI router — next/link không phù hợp ở đây, và một hard
                navigation là cách reset trạng thái lỗi nghiêm trọng. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                borderRadius: 8,
                border: "1px solid #d1d5db",
                backgroundColor: "#ffffff",
                color: "#374151",
                padding: "10px 18px",
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              Về trang chủ
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
