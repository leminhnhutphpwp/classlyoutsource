"use client";

import { useEffect, useMemo, useState } from "react";
import { isTokenExpired } from "@/lib/media-token-utils";

interface PdfViewerProps {
  streamUrl: string;
  expiresAt: string;
  fileName: string;
  onRefreshToken?: () => Promise<string | null>;
}

export function PdfViewer({
  streamUrl,
  expiresAt,
  fileName,
  onRefreshToken,
}: PdfViewerProps) {
  const [url, setUrl] = useState(streamUrl);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const maybeRefresh = async () => {
      if (isTokenExpired(expiresAt) && onRefreshToken) {
        const newUrl = await onRefreshToken();
        if (newUrl) {
          setUrl(newUrl);
        }
      }
      setLoading(false);
    };
    void maybeRefresh();
  }, [expiresAt, onRefreshToken]);

  // Tối ưu URL cho viewer mặc định (ẩn sidebar, fit theo chiều ngang)
  const viewerUrl = useMemo(() => {
    if (!url) return url;
    const hasHash = url.includes("#");
    const suffix = "navpanes=0&zoom=page-width";
    return url + (hasHash ? "&" : "#") + suffix;
  }, [url]);

  return (
    <div className="relative w-full bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-700 z-10">
          <div className="animate-spin rounded-full h-8 w-8 border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
        </div>
      )}
      <div className="w-full h-[70vh] md:h-[80vh]">
        <iframe
          src={viewerUrl || url}
          width="100%"
          height="100%"
          className="border-0"
          title={fileName}
        />
      </div>
    </div>
  );
}