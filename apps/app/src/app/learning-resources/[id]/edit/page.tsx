"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLearningResource, useUpdateLearningResource, useSubjects, useGradeLevels } from "@/hooks/use-api";
import { useGoBack } from "@/hooks/use-go-back";
import { useAuthContext } from "@/contexts/auth-context";
import InputGroup from "@/components/FormElements/InputGroup";
import SelectInput from "@/components/FormElements/SelectInput";
import FileUpload from "@/components/FormElements/FileUpload";
import RichTextEditor from "@/components/FormElements/RichTextEditorDynamic";
import TagsInput from "@/components/FormElements/TagsInput";
import { ArrowLeftIcon, DocumentTextIcon, CheckCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useNotification } from "@/hooks/use-notification";
import ImageUpload from "@/components/FormElements/ImageUpload";
import {
  getLearningResourceDisplayFileName,
  getLearningResourceFileSize,
} from "@/lib/learning-resource-helpers";
import { formatFileSize } from "@/lib/format-number";
import { extractErrorMessage, extractFieldErrors, extractStorageLimitErrorDetails } from "@/lib/api-error-utils";
import Button from "@/components/Common/Button";
import { getObjId } from "@/lib/id-utils";
import { convertMediaUrlToNextRoute } from "@/lib/media-url-utils";

export default function EditLearningResourcePage() {
  const params = useParams();
  const router = useRouter();
  const resourceId = params.id as string;
  const { user } = useAuthContext();

  // Use browser history navigation
  const handleGoBack = useGoBack(`/learning-resources/${resourceId}`);

  // All hooks must be called before any early returns
  const { data: resource, loading: resourceLoading, error: resourceError, permissions } = useLearningResource(resourceId);

  const { mutate: updateResource, loading: updateLoading } = useUpdateLearningResource();
  const { data: subjects, loading: subjectsLoading } = useSubjects({ is_active: true, sort: 'order', order: 'asc' });
  const { data: gradeLevels, loading: gradeLevelsLoading } = useGradeLevels({ is_active: true, sort: 'order', order: 'asc' });
  const { success, error: showError } = useNotification();

  // Check permissions from API response
  const canManageFromApi = permissions?.can_manage ?? false;

  // Check if user is Tutor (cannot share publicly in tutor-only system)
  const isTutor = user?.is_tutor || user?.role === 'tutor';

  // All useState hooks must be called before any early returns
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "document",
    external_url: "",
    status: "active",
    is_public: false,
    topic: "",
    tags: [] as string[],
    subject_id: "",
    grade_level_id: "",
  });

  const [file, setFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]); // Multiple images for image type
  const [isReplacing, setIsReplacing] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [deletedMediaIds, setDeletedMediaIds] = useState<string[]>([]); // Track deleted media IDs

  // All useEffect hooks must be called before any early returns
  useEffect(() => {
    if (resource) {
      setFormData({
        title: resource.title || "",
        description: resource.description || "",
        type: resource.type || "document",
        external_url: resource.external_url || "",
        status: resource.status || "active",
        is_public: resource.is_public || false,
        topic: resource.topic || "",
        tags: resource.tags || [],
        subject_id: (resource.subject_id || (resource.subject && getObjId(resource.subject)))?.toString() || "",
        grade_level_id: (resource.grade_level_id || (resource.grade_level && getObjId(resource.grade_level)))?.toString() || "",
      });
    }
  }, [resource]);

  // Check permission via API response - backend will return 403 if user doesn't have access
  useEffect(() => {
    if (resourceError) {
      // Check if error is 403/UNAUTHORIZED - backend denied access
      const isUnauthorized =
        typeof resourceError === 'string' && (
          resourceError.includes('403') ||
          resourceError.includes('UNAUTHORIZED') ||
          resourceError.includes('Không có quyền') ||
          resourceError.includes('Không có quyền truy cập')
        );

      if (isUnauthorized) {
        router.replace("/403");
      }
    }
  }, [resourceError, router]);

  // Consolidate loading state - check loading FIRST before permission checks
  const isLoading = resourceLoading || subjectsLoading || gradeLevelsLoading;

  // Show loading skeleton FIRST - before any permission checks
  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="h-10 w-24 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="flex-1">
            <div className="h-8 w-64 rounded bg-gray-200 dark:bg-gray-700 animate-pulse mb-2" />
            <div className="h-4 w-48 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
          </div>
        </div>

        {/* Form Skeleton */}
        <div className="max-w-2xl rounded-lg bg-white p-6 dark:bg-gray-800 space-y-6">
          <div className="h-6 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />

          <div className="space-y-6">
            {/* Loại tài liệu */}
            <div className="space-y-2">
              <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-12 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>

            {/* File upload area */}
            <div className="space-y-2">
              <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-32 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>

            {/* Tiêu đề */}
            <div className="space-y-2">
              <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-12 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>

            {/* Mô tả */}
            <div className="space-y-2">
              <div className="h-4 w-12 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-24 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>

            {/* Môn học và Cấp độ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-12 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-12 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
            </div>

            {/* Chủ đề */}
            <div className="space-y-2">
              <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-12 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <div className="h-4 w-12 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-12 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>

            {/* Trạng thái và checkbox */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-12 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
              <div className="pt-8">
                <div className="h-4 w-48 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 sm:gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="h-10 w-20 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-10 w-32 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Check error AFTER loading is done
  if (resourceError || (!resourceLoading && !resource)) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
        <h3 className="font-medium mb-2">Lỗi tải dữ liệu</h3>
        <p>{resourceError || "Không tìm thấy tài liệu"}</p>
      </div>
    );
  }

  // Show nothing while checking permissions or redirecting (only after loading is done)
  if (!isLoading && (resource && permissions !== undefined && !canManageFromApi)) {
    return null;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // Xóa lỗi của field khi user bắt đầu nhập lại
    if (fieldErrors[name]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleRichTextChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      description: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    // Get resourceId from params directly as fallback
    const currentResourceId = resourceId || (params?.id as string) || '';

    // Validate resourceId
    if (!currentResourceId || currentResourceId === 'undefined' || currentResourceId === 'null' || currentResourceId === '' || currentResourceId.trim() === '') {
      showError("Không tìm thấy ID tài liệu. Vui lòng tải lại trang.");
      return;
    }

    if (!formData.title.trim()) {
      showError("Vui lòng nhập tiêu đề");
      return;
    }

    // Tutors cannot share publicly - force is_public = false
    const isPublicValue = isTutor ? false : formData.is_public;

    try {
      // Create FormData if file exists or imageFiles exist
      if (file || (formData.type === 'image' && imageFiles.length > 0)) {
        const formDataToSend = new FormData();
        formDataToSend.append('title', formData.title);
        if (formData.description) formDataToSend.append('description', formData.description);
        formDataToSend.append('type', formData.type);
        formDataToSend.append('status', formData.status);
        formDataToSend.append('is_public', isPublicValue ? '1' : '0');
        if (formData.topic) formDataToSend.append('topic', formData.topic);
        if (formData.tags && formData.tags.length > 0) {
          formData.tags.forEach((tag, index) => {
            formDataToSend.append(`tags[${index}]`, tag);
          });
        }
        if (formData.subject_id) formDataToSend.append('subject_id', formData.subject_id);
        if (formData.grade_level_id) formDataToSend.append('grade_level_id', formData.grade_level_id);

        // Gửi danh sách media IDs bị xóa
        if (deletedMediaIds.length > 0) {
          deletedMediaIds.forEach((mediaId, index) => {
            formDataToSend.append(`deleted_media_ids[${index}]`, mediaId);
          });
        }

        // Handle multiple images for image type
        if (formData.type === 'image' && imageFiles.length > 0) {
          imageFiles.forEach((imageFile) => {
            formDataToSend.append('files[]', imageFile);
          });
        } else if (file) {
          // Single file for other types
          formDataToSend.append('file', file, file.name);
        }

        // Use currentResourceId from handleSubmit scope
        const result = await updateResource({ id: currentResourceId, data: formDataToSend });
        if (result.success) {
          success("Cập nhật tài liệu thành công");
          setTimeout(() => {
            router.push(`/learning-resources/${resourceId}`);
          }, 500);
        } else {
          // Check for storage limit error
          const storageErrorDetails = extractStorageLimitErrorDetails(result);
          if (storageErrorDetails && result.code === 'STORAGE_LIMIT_EXCEEDED') {
            // Show detailed storage error message
            const errorMsg = result.message || "Dung lượng lưu trữ không đủ";
            showError(errorMsg);
            // Set field error for file field
            setFieldErrors({ file: errorMsg });
          } else {
            // Sử dụng utility function để extract errors
            const errors = extractFieldErrors(result);
            const errorMessage = extractErrorMessage(result, "Có lỗi xảy ra khi cập nhật tài liệu");

            setFieldErrors(errors);
            showError(errorMessage);
          }
        }
      } else {
        // Update without file - build object safely
        const updateData: any = {
          title: formData.title || '',
          type: formData.type || 'document',
          status: formData.status || 'active',
          is_public: isPublicValue,
        };

        // Only add optional fields if they have values
        if (formData.description && formData.description.trim()) {
          updateData.description = formData.description;
        }
        if (formData.type === 'link' && formData.external_url && formData.external_url.trim()) {
          updateData.external_url = formData.external_url;
        }
        if (formData.topic && formData.topic.trim()) {
          updateData.topic = formData.topic;
        }
        if (formData.tags && Array.isArray(formData.tags) && formData.tags.length > 0) {
          updateData.tags = formData.tags.filter(tag => tag && tag.trim());
        }
        if (formData.subject_id && formData.subject_id.trim()) {
          updateData.subject_id = formData.subject_id;
        }
        if (formData.grade_level_id && formData.grade_level_id.trim()) {
          updateData.grade_level_id = formData.grade_level_id;
        }

        // Thêm danh sách media IDs bị xóa
        if (deletedMediaIds.length > 0) {
          updateData.deleted_media_ids = deletedMediaIds;
        }

        // Use currentResourceId from handleSubmit scope
        const result = await updateResource({ id: currentResourceId, data: updateData });

        if (result.success) {
          success("Cập nhật tài liệu thành công");
          setTimeout(() => {
            router.push(`/learning-resources/${resourceId}`);
          }, 500);
        } else {
          // Sử dụng utility function để extract errors
          const errors = extractFieldErrors(result);
          const errorMessage = extractErrorMessage(result, "Có lỗi xảy ra khi cập nhật tài liệu");

          setFieldErrors(errors);
          showError(errorMessage);
        }
      }
    } catch (_err) {
      showError('Lỗi khi cập nhật tài liệu');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
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
          <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white truncate">Chỉnh sửa tài liệu</h1>
          <p className="text-dark-4 dark:text-dark-6 mt-1 break-words">
            Cập nhật thông tin tài liệu học tập
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-2xl rounded-lg bg-white p-6 dark:bg-gray-800 space-y-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Thông tin cơ bản</h2>

        <div className="space-y-6">


          <SelectInput
            label="Loại tài liệu"
            name="type"
            value={formData.type}
            onChange={handleChange}
            options={[
              { value: "document", label: "Tài liệu" },
              { value: "pdf", label: "PDF" },
              { value: "video", label: "Video" },
              { value: "image", label: "Hình ảnh" },
              { value: "audio", label: "Âm thanh" },
              { value: "link", label: "Liên kết" },
              { value: "other", label: "Khác" },
            ]}
            required
          />

          {formData.type === 'link' ? (
            <div>
              <InputGroup
                label="Liên kết"
                name="external_url"
                type="url"
                value={formData.external_url}
                handleChange={handleChange}
                placeholder="https://example.com"
                required={formData.type === 'link'}
              />
              {fieldErrors.external_url && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.external_url}</p>
              )}
            </div>
          ) : (
            <div>
              {!isReplacing && !file && !imageFiles.length && (resource.media?.download_url || resource.file_url || resource.media_files?.length) ? (() => {
                const displayFileName = getLearningResourceDisplayFileName(resource);
                const fileSize = getLearningResourceFileSize(resource);

                // Hiển thị gallery cho type image với nhiều hình
                if (formData.type === 'image' && resource.media_files?.length) {
                  return (
                    <div>
                      <div className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                        Hình ảnh hiện tại ({resource.media_files.filter((mediaFile: any) => !deletedMediaIds.includes(mediaFile._id)).length} hình)
                      </div>

                      {/* Gallery hiển thị hình ảnh hiện tại */}
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {resource.media_files
                            .filter((mediaFile: any) => !deletedMediaIds.includes(mediaFile._id))
                            .map((mediaFile: any, index: number) => (
                              <div key={index} className="relative group">
                                <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                  <img
                                    src={convertMediaUrlToNextRoute(mediaFile.thumbnail_url) ||
                                      convertMediaUrlToNextRoute(mediaFile.preview_url) ||
                                      mediaFile.download_url}
                                    alt={mediaFile.name || `Hình ${index + 1}`}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      // Fallback chain khi image load fail
                                      const target = e.target as HTMLImageElement;
                                      const previewUrl = convertMediaUrlToNextRoute(mediaFile.preview_url);
                                      if (target.src.includes('thumbnail') && previewUrl) {
                                        target.src = previewUrl;
                                      } else if (target.src.includes('preview') && mediaFile.download_url) {
                                        target.src = mediaFile.download_url;
                                      }
                                    }}
                                  />
                                </div>

                                {/* Nút xóa */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    // Xóa media khỏi danh sách hiển thị
                                    setDeletedMediaIds(prev => [...prev, mediaFile._id]);
                                  }}
                                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 transition-opacity opacity-0 group-hover:opacity-100 hover:bg-red-600"
                                  title="Xóa hình ảnh"
                                >
                                  <XMarkIcon className="h-4 w-4" />
                                </button>

                                {/* File info */}
                                <div className="mt-1">
                                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate" title={mediaFile.name}>
                                    {mediaFile.name || `Hình ${index + 1}`}
                                  </p>
                                  {mediaFile.size && (
                                    <p className="text-xs text-gray-400 dark:text-gray-500">
                                      {formatFileSize(mediaFile.size)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>

                        {/* Nút thay đổi */}
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => setIsReplacing(true)}
                            className="text-sm font-medium text-primary hover:text-primary-dark transition-colors flex items-center gap-1"
                          >
                            <XMarkIcon className="h-4 w-4" />
                            Thay đổi hình ảnh
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Hiển thị file đơn cho các type khác
                return (
                  <div>
                    <div className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                      File hiện tại
                    </div>
                    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
                      <DocumentTextIcon className="h-5 w-5 text-primary" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white break-words">
                          {displayFileName}
                        </p>
                        {fileSize && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {fileSize}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsReplacing(true)}
                        className="rounded-full p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                        title="Thay đổi file"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                );
              })() : (
                <div key={`file-upload-${formData.type}`}>
                  {formData.type === 'image' ? (
                    <ImageUpload
                      label="Hình ảnh mới (tùy chọn - để trống nếu không thay đổi)"
                      name="images"
                      value={imageFiles}
                      onChange={(files) => {
                        setImageFiles(files);

                        // Clear field errors
                        if (files.length > 0 && fieldErrors.files) {
                          setFieldErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors.files;
                            return newErrors;
                          });
                        }
                      }}
                      onError={showError}
                      error={fieldErrors.files}
                      disabled={updateLoading}
                      maxFiles={10}
                      maxFileSize={5 * 1024 * 1024}
                    />
                  ) : (
                    <FileUpload
                      label="File mới (tùy chọn - để trống nếu không thay đổi)"
                      value={file}
                      onChange={(newFile) => {
                        setFile(newFile);

                        if (fieldErrors.file) {
                          setFieldErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors.file;
                            return newErrors;
                          });
                        }

                        if (newFile) {
                          const updates: any = {};

                          // Auto-detect type
                          const extension = newFile.name.split('.').pop()?.toLowerCase();
                          if (newFile.type.startsWith('image/')) {
                            updates.type = 'image';
                          } else if (newFile.type.startsWith('video/')) {
                            updates.type = 'video';
                          } else if (newFile.type.startsWith('audio/')) {
                            updates.type = 'audio';
                          } else if (newFile.type === 'application/pdf' || extension === 'pdf') {
                            updates.type = 'pdf';
                          } else if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'].includes(extension || '')) {
                            updates.type = 'document';
                          }

                          // Auto-fill title if empty
                          if (!formData.title) {
                            const name = newFile.name.substring(0, newFile.name.lastIndexOf('.')) || newFile.name;
                            updates.title = name;
                          }

                          if (Object.keys(updates).length > 0) {
                            setFormData(prev => ({ ...prev, ...updates }));
                          }
                        }
                      }}
                      accept={
                        formData.type === 'pdf' ? '.pdf' :
                          formData.type === 'video' ? 'video/*' :
                            formData.type === 'image' ? 'image/*' :
                              formData.type === 'audio' ? 'audio/*' :
                                formData.type === 'document' ? '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt' :
                                  undefined
                      }
                      helperText={
                        formData.type === 'pdf' ? 'PDF' :
                          formData.type === 'video' ? 'Video (MP4, AVI, MOV...)' :
                            formData.type === 'image' ? 'Hình ảnh (JPG, PNG, GIF...)' :
                              formData.type === 'audio' ? 'Âm thanh (MP3, WAV...)' :
                                formData.type === 'document' ? 'PDF, Word, Excel, PowerPoint...' :
                                  'Tất cả các định dạng file'
                      }
                      error={fieldErrors.file}
                    />
                  )}
                  {isReplacing && !file && !imageFiles.length && (resource.media?.download_url || resource.file_url || resource.media_files?.length) && (
                    <button
                      type="button"
                      onClick={() => setIsReplacing(false)}
                      className="mt-2 text-sm font-medium text-gray-500 hover:text-primary transition-colors flex items-center gap-1"
                    >
                      <ArrowLeftIcon className="h-3 w-3" />
                      Hủy thay đổi (Giữ lại file cũ)
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <InputGroup
              label="Tiêu đề"
              name="title"
              type="text"
              value={formData.title}
              handleChange={handleChange}
              placeholder="Nhập tiêu đề tài liệu"
              required
            />
            {fieldErrors.title && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.title}</p>
            )}
          </div>

          <RichTextEditor
            label="Mô tả"
            value={formData.description}
            onChange={handleRichTextChange}
            placeholder="Nhập mô tả tài liệu (tùy chọn)"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <SelectInput
                label="Môn học"
                name="subject_id"
                value={formData.subject_id}
                onChange={handleChange}
                options={[
                  { value: "", label: "-- Chọn môn học --" },
                  ...(subjects?.map((subject: any) => ({
                    value: getObjId(subject),
                    label: subject.name,
                  })) || []),
                ]}
              />
              {fieldErrors.subject_id && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.subject_id}</p>
              )}
            </div>

            <div>
              <SelectInput
                label="Cấp độ/Khối"
                name="grade_level_id"
                value={formData.grade_level_id}
                onChange={handleChange}
                options={[
                  { value: "", label: "-- Chọn cấp độ --" },
                  ...(gradeLevels?.map((gradeLevel: any) => ({
                    value: getObjId(gradeLevel),
                    label: gradeLevel.name,
                  })) || []),
                ]}
              />
              {fieldErrors.grade_level_id && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.grade_level_id}</p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="topic" className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
              Chủ đề
            </label>
            <input
              id="topic"
              name="topic"
              type="text"
              value={formData.topic}
              onChange={handleChange}
              placeholder="Ví dụ: Toán học, Lịch sử..."
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-primary"
            />
          </div>

          <TagsInput
            label="Tags"
            value={formData.tags}
            onChange={(tags) => {
              setFormData(prev => ({ ...prev, tags }));
              if (fieldErrors.tags) {
                setFieldErrors(prev => {
                  const newErrors = { ...prev };
                  delete newErrors.tags;
                  return newErrors;
                });
              }
            }}
            placeholder="Nhập tag và nhấn Enter hoặc dấu phẩy"
            error={fieldErrors.tags}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <SelectInput
                label="Trạng thái"
                name="status"
                value={formData.status}
                onChange={handleChange}
                options={[
                  { value: "active", label: "Đang dùng" },
                  { value: "archived", label: "Đã lưu trữ" },
                ]}
              />
            </div>

            {/* Tutors cannot share publicly in tutor-only system */}
            {!isTutor && (
              <div className="flex items-center pt-8">
                <input
                  id="is_public"
                  name="is_public"
                  type="checkbox"
                  checked={formData.is_public}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary dark:border-gray-600"
                />
                <label htmlFor="is_public" className="ml-2 text-sm font-medium text-gray-900 dark:text-white">
                  Chia sẻ công khai (các giáo viên khác có thể xem)
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 sm:gap-4">
          <Button
            type="button"
            onClick={handleGoBack}
            variant="outline"
            size="sm"
            className="w-full sm:w-auto justify-center"
          >
            Hủy
          </Button>
          <Button
            type="submit"
            disabled={updateLoading}
            loading={updateLoading}
            size="sm"
            variant="primary"
            icon={<CheckCircleIcon />}
            className="w-full sm:w-auto justify-center"
          >
            Cập nhật tài liệu
          </Button>
        </div>
      </form >
    </div >
  );
}

