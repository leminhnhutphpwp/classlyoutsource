"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { isTokenExpired } from "@/lib/media-token-utils";
import Button from "@/components/Common/Button";
import DownloadButton from "@/components/Common/DownloadButton";
import { convertMediaUrlToNextRoute } from "@/lib/media-url-utils";

interface DocumentViewerProps {
  previewUrl: string;
  downloadUrl: string;
  expiresAt: string;
  fileName: string;
  onRefreshToken?: () => Promise<string | null>;
  onPreviewNotSupported?: (notSupported: boolean) => void;
}

interface PreviewErrorResponse {
  success: false;
  message: string;
  download_url?: string;
  code?: string;
}

export function DocumentViewer({
  previewUrl,
  downloadUrl,
  expiresAt,
  fileName,
  onRefreshToken,
  onPreviewNotSupported,
}: DocumentViewerProps) {
  const [url, setUrl] = useState(previewUrl);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [previewNotSupported, setPreviewNotSupported] = useState(false);
  const [errorDownloadUrl, setErrorDownloadUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const checkingRef = useRef(false);
  const urlRef = useRef(previewUrl);

  // Update urlRef when previewUrl changes
  useEffect(() => {
    urlRef.current = previewUrl;
    setUrl(previewUrl);
  }, [previewUrl]);

  const checkPreviewSupport = useCallback(async (urlToCheck: string) => {
    // Prevent multiple simultaneous checks
    if (checkingRef.current) return;
    
    try {
      checkingRef.current = true;
      setLoading(true);
      
      // Fetch preview URL to check if it's a JSON error response
      const response = await fetch(urlToCheck);
      const contentType = response.headers.get('content-type');
      
      // If response is JSON, it's likely an error from backend
      if (contentType?.includes('application/json')) {
        const errorData: PreviewErrorResponse = await response.json();

        const notSupportedByCode = errorData.code === 'PREVIEW_NOT_SUPPORTED';
        const notSupportedByMessage = (errorData.message || '').toLowerCase().includes('không thể xem trước');

        if (notSupportedByCode || notSupportedByMessage) {
          // Batch state updates
          setPreviewNotSupported(true);
          setErrorDownloadUrl(errorData.download_url || downloadUrl);
          setErrorMessage(errorData.message || 'Loại file này không thể xem trước. Vui lòng tải xuống để xem.');
          setError(false);
          setLoading(false);
          onPreviewNotSupported?.(true);
          checkingRef.current = false;
          return;
        }
        
        // Other JSON errors
        setError(true);
        setPreviewNotSupported(false);
        setErrorMessage(errorData.message || 'Không thể tải tài liệu');
        setLoading(false);
        checkingRef.current = false;
        return;
      }
      
      // Preview is supported (response is a file, not JSON error)
      // Note: We can't use the response body here as it's consumed
      // The iframe will load the URL directly
      setPreviewNotSupported(false);
      setError(false);
      setErrorMessage(null);
      setLoading(false);
      onPreviewNotSupported?.(false);
      checkingRef.current = false;
    } catch (err) {
      // If fetch fails, assume preview might still work (let iframe try)
      // Or it could be a network error
      console.error('Error checking preview support:', err);
      setPreviewNotSupported(false);
      setError(false);
      setLoading(false);
      checkingRef.current = false;
    }
  }, [downloadUrl, onPreviewNotSupported]);

  const refreshToken = useCallback(async () => {
    if (!onRefreshToken) return;
    
    const newUrl = await onRefreshToken();
    if (newUrl) {
      urlRef.current = newUrl;
      setUrl(newUrl);
      // Re-check preview support with new URL
      await checkPreviewSupport(newUrl);
    } else {
      setError(true);
      setPreviewNotSupported(false);
      setErrorMessage('Không thể làm mới token');
    }
  }, [onRefreshToken, checkPreviewSupport]);

  useEffect(() => {
    // Reset checking flag when URL changes
    checkingRef.current = false;
    
    // Check token expiration on mount and when expiresAt changes
    if (isTokenExpired(expiresAt) && onRefreshToken) {
      refreshToken();
    } else {
      // Check if preview is supported
      checkPreviewSupport(urlRef.current);
    }
  }, [previewUrl, expiresAt, refreshToken, checkPreviewSupport, onRefreshToken]);

  const handleError = useCallback(() => {
    // Don't set error if preview is already known to be not supported
    if (!previewNotSupported) {
      setError(true);
      setLoading(false);
    }
  }, [previewNotSupported]);

  // Memoize download URL to avoid recalculation
  const finalDownloadUrl = useMemo(
    () => errorDownloadUrl || downloadUrl,
    [errorDownloadUrl, downloadUrl]
  );

  // Ensure download uses Next.js proxied route when provided
  const proxiedDownloadUrl = useMemo(
    () => convertMediaUrlToNextRoute(finalDownloadUrl) || finalDownloadUrl,
    [finalDownloadUrl]
  );

  const handleRetry = useCallback(async () => {
    setError(false);
    setLoading(true);
    
    // Just retry checking preview support with current URL
    // This avoids refetching the entire resource and causing page-level loading
    await checkPreviewSupport(urlRef.current);
    
    setLoading(false);
  }, [checkPreviewSupport]);

  // Preview not supported - show message and download button only
  if (previewNotSupported) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <p className="text-gray-600 dark:text-gray-400 mb-4 text-center">
          {errorMessage || 'Loại file này không thể xem trước. Vui lòng tải xuống để xem.'}
        </p>
        <DownloadButton
          url={proxiedDownloadUrl || ""}
          filename={fileName}
          size="sm"
          variant="primary"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {errorMessage || 'Không thể tải tài liệu'}
        </p>
        <div className="flex gap-2">
          <Button
            onClick={handleRetry}
            variant="primary"
            size="sm"
            disabled={loading}
          >
            {loading ? 'Đang thử lại...' : 'Thử lại'}
          </Button>
          <DownloadButton
            url={proxiedDownloadUrl || ""}
            filename={fileName}
            size="sm"
            variant="secondary"
          />
        </div>
      </div>
    );
  }

  // Early return for error state (already handled above)
  if (error) {
    return null;
  }

  return (
    <div className="relative w-full bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-700 z-10">
          <div className="animate-spin rounded-full h-8 w-8 border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}></div>
        </div>
      )}
      <div className="w-full" style={{ height: "80vh" }}>
        <iframe
          src={url}
          width="100%"
          height="100%"
          className="border-0"
          title={fileName}
          onLoad={() => setLoading(false)}
          onError={handleError}
        />
      </div>
    </div>
  );
}

