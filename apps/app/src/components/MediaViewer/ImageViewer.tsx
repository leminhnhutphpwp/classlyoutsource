"use client";

import Image from "next/image";
import { useState } from "react";
import { isTokenExpired } from "@/lib/media-token-utils";

interface ImageViewerProps {
  previewUrl: string;
  alt: string;
  expiresAt: string;
  onRefreshToken?: () => Promise<string | null>;
}

export function ImageViewer({
  previewUrl,
  alt,
  expiresAt,
  onRefreshToken,
}: ImageViewerProps) {
  const [url, setUrl] = useState(previewUrl);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const handleError = async () => {
    // Check if token expired
    if (isTokenExpired(expiresAt) && onRefreshToken) {
      const newUrl = await onRefreshToken();
      if (newUrl) {
        setUrl(newUrl);
        setError(false);
        setLoading(false);
        return;
      }
    }
    setError(true);
    setLoading(false);
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Không thể tải hình ảnh
        </p>
        {onRefreshToken && (
          <button
            onClick={async () => {
              setError(false);
              setLoading(true);
              const newUrl = await onRefreshToken();
              if (newUrl) {
                setUrl(newUrl);
              } else {
                setError(true);
              }
              setLoading(false);
            }}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Thử lại
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full h-auto bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-700">
          <div className="animate-spin rounded-full h-8 w-8 border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}></div>
        </div>
      )}
      <Image
        src={url}
        alt={alt}
        width={1200}
        height={800}
        className="w-full h-auto"
        onError={handleError}
        onLoad={() => setLoading(false)}
        unoptimized // Vì URL đã có token, không cần optimize
      />
    </div>
  );
}

