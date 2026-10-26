"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { isTokenExpired } from "@/lib/media-token-utils";

interface VideoPlayerProps {
  streamUrl: string;
  expiresAt: string;
  onRefreshToken?: () => Promise<string | null>;
  autoPlay?: boolean;
  controls?: boolean;
}

export function VideoPlayer({
  streamUrl,
  expiresAt,
  onRefreshToken,
  autoPlay = false,
  controls = true,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [url, setUrl] = useState(streamUrl);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshToken = useCallback(async () => {
    if (onRefreshToken) {
      const newUrl = await onRefreshToken();
      if (newUrl) {
        setUrl(newUrl);
        if (videoRef.current) {
          videoRef.current.load();
        }
      } else {
        setError(true);
      }
    }
  }, [onRefreshToken]);

  useEffect(() => {
    // Check token expiration on mount and when expiresAt changes
    if (isTokenExpired(expiresAt) && onRefreshToken) {
      refreshToken();
    }
  }, [expiresAt, onRefreshToken, refreshToken]);

  const handleError = async () => {
    // Try to refresh token if expired
    if (isTokenExpired(expiresAt) && onRefreshToken) {
      await refreshToken();
    } else {
      setError(true);
    }
    setLoading(false);
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Không thể phát video
        </p>
        {onRefreshToken && (
          <button
            onClick={async () => {
              setError(false);
              setLoading(true);
              await refreshToken();
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
    <div className="relative w-full bg-gray-900 rounded-lg overflow-hidden aspect-video">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800 z-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      )}
      <video
        ref={videoRef}
        src={url}
        controls={controls}
        autoPlay={autoPlay}
        preload="metadata"
        controlsList="nodownload noplaybackrate"
        disablePictureInPicture
        onError={handleError}
        onLoadedData={() => setLoading(false)}
        onCanPlay={() => setLoading(false)}
        className="w-full h-full object-contain bg-black"
      >
        Trình duyệt của bạn không hỗ trợ video.
      </video>
    </div>
  );
}

