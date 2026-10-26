"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLearningResource, useDeleteLearningResource } from "@/hooks/use-api";
import { useGoBack } from "@/hooks/use-go-back";
import { useAuthContext } from "@/contexts/auth-context";
import { canManageLearningResource } from "@/lib/authz";
import DownloadButton from "@/components/Common/DownloadButton";
import {
  getLearningResourceFileName,
  getLearningResourceFileSize,
  getLearningResourceDownloadUrl,
  getLearningResourceTypeBadge,
} from "@/lib/learning-resource-helpers";
import Button from "@/components/Common/Button";
import ButtonLink from "@/components/Common/ButtonLink";
import {
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  AcademicCapIcon,
  UserIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  CalendarIcon,
  TagIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import ConfirmDeleteDialog from "@/components/Common/ConfirmDeleteDialog";
import { useNotification } from "@/hooks/use-notification";
import RichTextDisplay from "@/components/Common/RichTextDisplay";
import { MediaViewer } from "@/components/MediaViewer/MediaViewer";
import { useMediaOptimization } from "@/hooks/use-media-optimization";
import ProcessingIndicator from "@/components/MediaViewer/ProcessingIndicator";
export default function LearningResourceDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthContext();
  const resourceId = params.id as string;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { success, error: showError } = useNotification();
  const { mutate: deleteResource, loading: deleting } = useDeleteLearningResource();

  // Use browser history navigation
  const handleGoBack = useGoBack('/learning-resources');

  const { data: resource, loading, error, refetch } = useLearningResource(resourceId);
  const [previewNotSupported, setPreviewNotSupported] = useState(false);

  // Media optimization hook
  const { isProcessing } = useMediaOptimization({
    media: resource?.media,
    mediaFiles: resource?.media_files,
    onOptimizationComplete: () => {
      // Refetch resource data when optimization completes
      refetch();
    }
  });

  // Function to refresh media token
  // This will refetch the resource, which will update the resource state
  // The MediaViewer components will automatically get the new URLs when resource updates
  const handleRefreshToken = async (_resourceId: number | string): Promise<string | null> => {
    try {
      // Refetch the resource to get new token
      // The refetch will update the resource state, causing components to re-render with new URLs
      await refetch();

      // Return the URL from the updated resource
      // Note: This might be called before state updates, but the component will re-render
      // with the new data from the refetch
      const media = (resource as any)?.media;
      if (media) {
        return media.preview_url || media.stream_url || null;
      }
      return null;
    } catch (error) {
      console.error('Error refreshing media token:', error);
      return null;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center gap-4">
          <div className="h-10 w-24 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="flex-1">
            <div className="h-8 w-64 rounded bg-gray-200 dark:bg-gray-700 animate-pulse mb-2" />
            <div className="h-4 w-48 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
          </div>
          <div className="h-10 w-24 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
        </div>

        {/* Content Skeleton */}
        <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="h-6 w-48 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-4 w-full rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-10 w-full rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-10 w-full rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !resource) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
        <h3 className="font-medium mb-2">Lỗi tải dữ liệu</h3>
        <p>{error || "Không tìm thấy tài liệu"}</p>
      </div>
    );
  }

  // Check if resource has media to display
  const hasMedia = !!resource.media || !!resource.external_url;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <Button
          onClick={handleGoBack}
          variant="outline"
          size="sm"
          icon={<ArrowLeftIcon />}
          className="w-full sm:w-auto justify-center"
        >
          Quay lại
        </Button>

        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white truncate">{resource.title}</h1>
          {resource.description && (
            <div className="text-dark-4 dark:text-dark-6 mt-1 line-clamp-2 whitespace-pre-line break-words">
              <RichTextDisplay content={resource.description} />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {(() => {
            const { canUpdate, canDelete } = canManageLearningResource(user, resource);

            if (!canUpdate && !canDelete) return null;

            return (
              <>
                {canUpdate && (
                  <ButtonLink
                    href={`/learning-resources/${resourceId}/edit`}
                    variant="outline"
                    size="sm"
                    icon={<PencilIcon />}
                    className="flex-1 sm:flex-initial justify-center"
                  >
                    Chỉnh sửa
                  </ButtonLink>
                )}
                {canDelete && (
                  <Button
                    onClick={() => setConfirmDelete(true)}
                    variant="danger"
                    size="sm"
                    icon={<TrashIcon />}
                    className="flex-1 sm:flex-initial justify-center"
                  >
                    Xóa
                  </Button>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {resource.description && (
            <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Mô tả
              </h3>
              <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 whitespace-pre-line">
                <RichTextDisplay content={resource.description} />
              </div>
            </div>
          )}

          {/* Media Viewer */}
          {hasMedia && (
            <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {resource.type === 'link' ? 'Liên kết' :
                    resource.type === 'image' && resource.media_files?.length > 1 ?
                      `Bộ sưu tập hình ảnh (${resource.media_files.length})` : 'Tài liệu'}
                </h3>
                {resource.type === 'image' && resource.media_files?.length > 1 && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {resource.media_files.length} hình ảnh
                  </span>
                )}
              </div>
              <MediaViewer
                resource={resource}
                onRefreshToken={handleRefreshToken}
                onPreviewNotSupported={setPreviewNotSupported}
              />
              {/* Processing indicator */}
              {isProcessing && (
                <div className="mt-4">
                  <ProcessingIndicator message="Đang tối ưu tài liệu..." />
                </div>
              )}
              {/* Download button (hide for video; only when preview is supported) */}
              {resource.type !== 'link' && resource.type !== 'video' && resource.type !== 'image' && resource.media?.download_url && !previewNotSupported && (
                <div className="mt-4">
                  <DownloadButton
                    url={getLearningResourceDownloadUrl(resource, resourceId) || resource.media.download_url}
                    filename={getLearningResourceFileName(resource) || undefined}
                    fileSize={getLearningResourceFileSize(resource) || undefined}
                    size="sm"
                    variant="secondary"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Resource Info */}
          <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Thông tin
            </h3>
            <div className="flex items-center gap-2 mb-3">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${resource.status === 'active'
                    ? 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]'
                    : 'bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]'
                  }`}
              >
                {resource.status === 'active' ? (
                  <>
                    <CheckCircleIcon className="h-4 w-4 mr-1" />
                    Hoạt động
                  </>
                ) : (
                  <>
                    <XCircleIcon className="h-4 w-4 mr-1" />
                    Đã lưu trữ
                  </>
                )}
              </span>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Loại</p>
                {(() => {
                  const typeBadge = getLearningResourceTypeBadge(resource);
                  if (!typeBadge) {
                    return (
                      <p className="text-gray-900 dark:text-white">
                        {resource.type_label || resource.type || 'N/A'}
                      </p>
                    );
                  }
                  return (
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-sm font-medium ${typeBadge.bgColor} ${typeBadge.textColor}`}>
                      {typeBadge.icon}
                      <span>{typeBadge.label}</span>
                    </span>
                  );
                })()}
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Quyền truy cập
                </p>
                <p className="text-gray-900 dark:text-white">
                  {resource.is_public ? 'Công khai' : 'Riêng tư'}
                </p>
              </div>

              {resource.subject_model && (
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Môn học</p>
                  <div className="flex items-center gap-2">
                    <AcademicCapIcon className="h-5 w-5 text-gray-400" />
                    <p className="text-gray-900 dark:text-white">{resource.subject_model.name}</p>
                  </div>
                </div>
              )}

              {resource.grade_level_model && (
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Cấp độ/Khối</p>
                  <p className="text-gray-900 dark:text-white">{resource.grade_level_model.name}</p>
                </div>
              )}

              {resource.topic && (
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Chủ đề</p>
                  <p className="text-gray-900 dark:text-white">{resource.topic}</p>
                </div>
              )}

              {resource.tags && resource.tags.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {resource.tags.map((tag: string, index: number) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-sm font-medium text-primary dark:bg-primary/20 dark:text-primary"
                      >
                        <TagIcon className="h-3 w-3" />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {resource.tutor && (
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Người tạo</p>
                  <div className="flex items-center gap-2">
                    <UserIcon className="h-5 w-5 text-gray-400" />
                    <p className="text-gray-900 dark:text-white">{resource.tutor.name}</p>
                  </div>
                </div>
              )}

              {resource.created_at && (
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Ngày tạo</p>
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5 text-gray-400" />
                    <p className="text-gray-900 dark:text-white">
                      {new Date(resource.created_at).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Statistics */}
          <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Thống kê
            </h3>
            <div className="space-y-4">
              {resource.views !== undefined && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <EyeIcon className="h-5 w-5 text-gray-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Lượt xem</span>
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-white">{resource.views}</span>
                </div>
              )}
              {resource.downloads !== undefined && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowDownTrayIcon className="h-5 w-5 text-gray-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Lượt tải</span>
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-white">{resource.downloads}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          const res = await deleteResource(resourceId);
          if (res.success) {
            setConfirmDelete(false);
            success("Xóa tài liệu thành công");
            router.push("/learning-resources");
          } else {
            showError(res.message || "Không thể xóa tài liệu");
          }
        }}
        loading={deleting}
        message="Bạn có chắc chắn muốn xóa tài liệu này? Hành động không thể hoàn tác."
      />
    </div>
  );
}

