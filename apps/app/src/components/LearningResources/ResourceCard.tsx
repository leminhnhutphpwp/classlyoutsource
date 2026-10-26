"use client";
import RichTextDisplay from "@/components/Common/RichTextDisplay";
import DownloadButton from "@/components/Common/DownloadButton";
import Link from "next/link";
import { DocumentTextIcon, LinkIcon, PlayIcon } from "@heroicons/react/24/outline";
import { getLearningResourceTypeBadge, getLearningResourceFileSize } from "@/lib/learning-resource-helpers";
import { MediaOptimizationUtils } from "@/lib/media-optimization-utils";
import { getObjId } from "@/lib/id-utils";

interface ResourceCardProps {
  resource: any;
  index?: number;
}

export default function ResourceCard({ resource, index }: ResourceCardProps) {
  const isVideo =
    resource.type === "video" ||
    resource.external_url?.includes("youtube") ||
    resource.external_url?.includes("youtu.be");
  const isExternal = !!resource.external_url;
  const resourceId = getObjId(resource);

  // Handle multiple images
  const isMultipleImages = resource.type === "image" && resource.media_files && resource.media_files.length > 1;
  const hasImages = resource.type === "image" && (resource.media_files?.length > 0 || resource.media);

  // Get media URL for display (backend handles optimization automatically)
  const getOptimizedImageUrl = (mediaItem: any) => {
    return MediaOptimizationUtils.getOptimizedUrl(mediaItem, 'thumbnail') ||
      MediaOptimizationUtils.getOptimizedUrl(mediaItem, 'preview');
  };

  const rawUrl = resource.media?.download_url
    ? resource.media.download_url
    : resource.file_url
      ? resource.file_url
      : (resourceId ? `/api/learning-resources/${resourceId}/download` : null);

  // Rewrite /api/v1 to /api if present to match frontend routes
  const downloadUrl = rawUrl ? rawUrl.replace('/api/v1/', '/api/') : null;
  const isFile = !!downloadUrl || !!resource.file_url;
  const isPdf = resource.type === "pdf" || resource.ext === "pdf";
  const canDownload = isFile && !isVideo && !isPdf && !hasImages; // Don't show download for images
  const canViewDetail = !!resourceId;
  const title = resource.title || `Tài liệu #${(index ?? 0) + 1}`;

  // Get type badge info
  const typeBadge = getLearningResourceTypeBadge(resource);

  return (
    <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
      <div className="flex-shrink-0">
        {hasImages && resource.media_files?.length > 0 ? (
          <div className="relative">
            <div className="size-10 sm:size-12 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
              <img
                src={getOptimizedImageUrl(resource.media_files[0])}
                alt={resource.title}
                className="w-full h-full object-cover"
              />
            </div>
            {isMultipleImages && (
              <div className="absolute -bottom-1 -right-1 bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                {resource.media_files.length}
              </div>
            )}
          </div>
        ) : hasImages && resource.media ? (
          <div className="relative">
            <div className="size-10 sm:size-12 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
              <img
                src={getOptimizedImageUrl(resource.media)}
                alt={resource.title}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        ) : (
          <div
            className={`size-10 sm:size-12 rounded-lg flex items-center justify-center ${isVideo ? "bg-primary-100 bg-primary-pastel/40" : "bg-primary-100"
              }`}
          >
            {isVideo ? (
              <PlayIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            ) : (
              <DocumentTextIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            )}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        {/* Title and Badge - Stack on mobile */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-1">
          <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white break-words">{title}</h4>
          {typeBadge && (
            <span className={`self-start sm:self-auto flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${typeBadge.bgColor} ${typeBadge.textColor}`}>
              {typeBadge.icon}
              <span>{typeBadge.label}</span>
            </span>
          )}
        </div>

        {resource.description && (
          <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-2 sm:mb-3 mt-1 line-clamp-2 sm:line-clamp-2 break-words">
            <RichTextDisplay content={resource.description} />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {isExternal && resource.external_url && (
            <a
              href={resource.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 hover:underline transition-colors"
            >
              <LinkIcon className="h-3.5 w-3.5 flex-shrink-0" />
              {isVideo ? "Xem video" : "Mở liên kết"}
            </a>
          )}

          {canDownload && downloadUrl && (
            <DownloadButton
              url={downloadUrl}
              filename={resource.media?.name}
              fileSize={getLearningResourceFileSize(resource)}
              size="sm"
              variant="ghost"
            />
          )}

          {canViewDetail && (
            <Link
              href={`/learning-resources/${resourceId}`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 hover:underline transition-colors"
            >
              {hasImages ? "Xem ảnh" : "Xem tài liệu"}
            </Link>
          )}

          {getLearningResourceFileSize(resource) && (
            <span className="text-xs text-gray-500 dark:text-gray-400 border-l border-gray-300 dark:border-gray-700 pl-2 ml-1">{getLearningResourceFileSize(resource)}</span>
          )}

          {isMultipleImages && (
            <span className="text-xs text-gray-500 dark:text-gray-400 border-l border-gray-300 dark:border-gray-700 pl-2 ml-1">
              {resource.media_files.length} hình ảnh
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

