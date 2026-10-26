"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { isTokenExpired } from "@/lib/media-token-utils";

interface AudioPlayerProps {
  streamUrl: string;
  expiresAt: string;
  onRefreshToken?: () => Promise<string | null>;
  autoPlay?: boolean;
  controls?: boolean;
}

export function AudioPlayer({
  streamUrl,
  expiresAt,
  onRefreshToken,
  autoPlay = false,
  controls = true,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [url, setUrl] = useState(streamUrl);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshToken = useCallback(async () => {
    if (onRefreshToken) {
      const newUrl = await onRefreshToken();
      if (newUrl) {
        setUrl(newUrl);
        if (audioRef.current) {
          audioRef.current.load();
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
          Không thể phát audio
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
    <div className="w-full bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
      {loading && (
        <div className="flex items-center justify-center mb-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}></div>
        </div>
      )}
      <audio
        ref={audioRef}
        src={url}
        controls={controls}
        autoPlay={autoPlay}
        preload="metadata"
        onError={handleError}
        onLoadedData={() => setLoading(false)}
        onCanPlay={() => setLoading(false)}
        className="w-full"
      >
        Trình duyệt của bạn không hỗ trợ audio.
      </audio>
    </div>
  );
}

