"use client";

import { useCallback, useMemo } from "react";
import { ImageViewer } from "./ImageViewer";
import { ImageGallery } from "./ImageGallery";
import { VideoPlayer } from "./VideoPlayer";
import { AudioPlayer } from "./AudioPlayer";
import { DocumentViewer } from "./DocumentViewer";
import { PdfViewer } from "./PdfViewer";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import Button from "@/components/Common/Button";
import type { LearningResource } from "@/lib/api-config";
import { convertMediaUrlToNextRoute } from "@/lib/media-url-utils";
import { getObjId } from "@/lib/id-utils";
import { MediaOptimizationUtils } from "@/lib/media-optimization-utils";

interface MediaViewerProps {
  resource: LearningResource;
  onRefreshToken?: (resourceId: string | number) => Promise<string | null>;
  onPreviewNotSupported?: (notSupported: boolean) => void;
}

interface MediaWithSignedUrls {
  preview_url?: string;
  stream_url?: string;
  thumbnail_url?: string;
  download_url?: string;
  name?: string;
  expires_at?: string;
}

export function MediaViewer({ resource, onRefreshToken, onPreviewNotSupported }: MediaViewerProps) {
  // Memoize refresh token function
  const refreshToken = useCallback(async (): Promise<string | null> => {
    const resourceId = getObjId(resource);
    if (onRefreshToken && resourceId) {
      // Prefer stream_url for pdf/video/audio, then preview, then download
      return await onRefreshToken(resourceId);
    }
    return null;
  }, [onRefreshToken, resource]);

  // Memoize type and media data
  const type = useMemo(() => resource.type?.toLowerCase(), [resource.type]);
  const media = useMemo(() => resource.media as MediaWithSignedUrls | undefined, [resource.media]);
  const expiresAt = useMemo(() => media?.expires_at || "", [media?.expires_at]);

  // External link
  if (resource.type === "link" && resource.external_url) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-2 mb-2">
          <ArrowTopRightOnSquareIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
            Liên kết bên ngoài
          </p>
        </div>
        <a
          href={resource.external_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-xs text-primary hover:underline break-all"
        >
          {resource.external_url}
        </a>
        <div className="mt-3">
          <Button
            onClick={() => window.open(resource.external_url!, "_blank")}
            variant="outline"
            size="sm"
            icon={<ArrowTopRightOnSquareIcon className="h-4 w-4" />}
            className="text-xs px-3 py-1"
          >
            Mở liên kết
          </Button>
        </div>
      </div>
    );
  }

  // No media
  if (!resource.media) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <p className="text-gray-600 dark:text-gray-400">
          Tài liệu không có file
        </p>
      </div>
    );
  }

  // Image - use media_files if available, otherwise fallback to media
  if (type === "image") {
    // Gallery with multiple images
    if (resource.media_files && resource.media_files.length > 0) {
      return (
        <ImageGallery
          mediaFiles={resource.media_files}
          title={resource.title}
          expiresAt={expiresAt}
          onRefreshToken={refreshToken}
        />
      );
    }

    // Single image fallback (only when no media_files)
    if (media?.preview_url) {
      // Get media URL (backend handles optimization automatically)
      const optimizedUrl = MediaOptimizationUtils.getOptimizedUrl(media, 'preview');
      const previewUrl = convertMediaUrlToNextRoute(optimizedUrl);
      if (previewUrl) {
        return (
          <ImageViewer
            previewUrl={previewUrl}
            alt={resource.title || "Hình ảnh"}
            expiresAt={expiresAt}
            onRefreshToken={refreshToken}
          />
        );
      }
    }
  }

  // Video (stream only, no download)
  if (type === "video" && media?.stream_url) {
    // Get media URL (backend handles optimization automatically)
    const optimizedUrl = MediaOptimizationUtils.getOptimizedUrl(media, 'stream');
    const streamUrl = convertMediaUrlToNextRoute(optimizedUrl);
    if (streamUrl) {
      return (
        <VideoPlayer
          streamUrl={streamUrl}
          expiresAt={expiresAt}
          onRefreshToken={refreshToken}
        />
      );
    }
  }

  // Audio
  if (type === "audio" && media?.stream_url) {
    // Get media URL (backend handles optimization automatically)
    const optimizedUrl = MediaOptimizationUtils.getOptimizedUrl(media, 'stream');
    const streamUrl = convertMediaUrlToNextRoute(optimizedUrl);
    if (streamUrl) {
      return (
        <AudioPlayer
          streamUrl={streamUrl}
          expiresAt={expiresAt}
          onRefreshToken={refreshToken}
        />
      );
    }
  }

  // PDF (own type, stream via /stream with Range)
  if (type === "pdf" && media?.stream_url) {
    // Get media URL (backend handles optimization automatically)
    const optimizedUrl = MediaOptimizationUtils.getOptimizedUrl(media, 'stream');
    const streamUrl = convertMediaUrlToNextRoute(optimizedUrl);
    if (streamUrl) {
      return (
        <PdfViewer
          streamUrl={streamUrl}
          expiresAt={expiresAt}
          fileName={media.name || resource.media?.name || resource.title || "document"}
          onRefreshToken={refreshToken}
        />
      );
    }
  }

  // Document / other (non-pdf)
  if ((type === "document" || type === "other") && media?.preview_url) {
    // Get media URL (backend handles optimization automatically)
    const optimizedUrl = MediaOptimizationUtils.getOptimizedUrl(media, 'preview');
    const previewUrl = convertMediaUrlToNextRoute(optimizedUrl);
    if (previewUrl) {
      return (
        <DocumentViewer
          previewUrl={previewUrl}
          downloadUrl={media.download_url || resource.media?.download_url || ""}
          expiresAt={expiresAt}
          fileName={media.name || resource.media?.name || resource.title || "document"}
          onRefreshToken={refreshToken}
          onPreviewNotSupported={onPreviewNotSupported}
        />
      );
    }
  }

  // Fallback: download link (hide for video to prevent download)
  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        Không thể xem trước tài liệu này
      </p>
      {resource.type !== "video" && resource.media.download_url && (
        <Button
          onClick={() => {
            window.open(resource.media!.download_url!, "_blank");
          }}
          variant="primary"
          size="sm"
          icon={<ArrowTopRightOnSquareIcon />}
        >
          Tải xuống: {resource.media.name || "file"}
        </Button>
      )}
    </div>
  );
}

