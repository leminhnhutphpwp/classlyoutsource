"use client";
import { useState, useEffect } from "react";
import { DocumentArrowUpIcon, LinkIcon, CloudArrowUpIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import AudioRecorder from "./AudioRecorder";
import apiClient from "@/lib/api-client";
import { useToast } from "@/contexts/toast-context";
import { getObjId } from "@/lib/id-utils";
import type { SubmissionType } from "./SubmissionTypesSelector";
interface DynamicSubmissionFormProps {
  allowedSubmissionTypes: SubmissionType[];
  assignmentId: string;
  value?: {
    content?: string;
    media_id?: string;
    external_url?: string;
  };
  onChange?: (data: {
    content?: string;
    media_id?: string;
    external_url?: string;
  }) => void;
  disabled?: boolean;
}

const SUBMISSION_TYPE_LABELS: Record<SubmissionType, string> = {
  text: 'Văn bản',
  file: 'File',
  document: 'Tài liệu',
  image: 'Hình ảnh',
  video: 'Video',
  audio: 'Ghi âm',
  link: 'Liên kết',
  quiz: 'Trắc nghiệm',
};

export default function DynamicSubmissionForm({
  allowedSubmissionTypes = ['text'],
  value,
  onChange,
  disabled = false,
}: DynamicSubmissionFormProps) {
  const [content, setContent] = useState(value?.content || '');
  const [mediaId, setMediaId] = useState<string | undefined>(value?.media_id);
  const [externalUrl, setExternalUrl] = useState(value?.external_url || '');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    if (onChange) {
      onChange({
        content: content || undefined,
        media_id: mediaId,
        external_url: externalUrl || undefined,
      });
    }
  }, [content, mediaId, externalUrl, onChange]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setUploadedFile(file);

      // Determine file type based on allowed types
      let fileType: 'audio' | 'image' | 'video' | 'document' | 'file' = 'file';

      if (allowedSubmissionTypes.includes('audio') && file.type.startsWith('audio/')) {
        fileType = 'audio';
      } else if (allowedSubmissionTypes.includes('image') && file.type.startsWith('image/')) {
        fileType = 'image';
      } else if (allowedSubmissionTypes.includes('video') && file.type.startsWith('video/')) {
        fileType = 'video';
      } else if (allowedSubmissionTypes.includes('document')) {
        const docTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (docTypes.includes(file.type)) {
          fileType = 'document';
        }
      }

      // Upload file
      const response = await apiClient.uploadMediaFile(file, fileType);

      if (response.success && getObjId(response.data)) {
        setMediaId(getObjId(response.data));
        addToast({ type: "success", title: "Upload file thành công" });
      } else {
        throw new Error(response.message || "Upload file thất bại");
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      const errorMessage = error instanceof Error
        ? error.message
        : "Lỗi khi upload file. Vui lòng thử lại.";
      addToast({ type: "error", title: errorMessage });
      setUploadedFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAudioComplete = (mediaId: string) => {
    setMediaId(mediaId);
  };

  const handleRemoveFile = () => {
    setMediaId(undefined);
    setUploadedFile(null);
  };

  // Determine which file types to accept
  const getAcceptTypes = (): string => {
    const accepts: string[] = [];

    if (allowedSubmissionTypes.includes('image')) {
      accepts.push('image/*');
    }
    if (allowedSubmissionTypes.includes('video')) {
      accepts.push('video/*');
    }
    if (allowedSubmissionTypes.includes('audio')) {
      accepts.push('audio/*');
    }
    if (allowedSubmissionTypes.includes('document')) {
      accepts.push('.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx');
    }
    if (allowedSubmissionTypes.includes('file')) {
      accepts.push('*/*');
    }

    return accepts.length > 0 ? accepts.join(',') : '*/*';
  };

  if (
    allowedSubmissionTypes.length === 1 &&
    allowedSubmissionTypes[0] === 'quiz'
  ) {
    return (
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm text-primary">
        Bài tập này yêu cầu làm trắc nghiệm trực tiếp trên hệ thống. Vui lòng sử dụng giao diện làm
        bài trắc nghiệm.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Text Submission */}
      {allowedSubmissionTypes.includes('text') && (
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
            Nội dung bài nộp {allowedSubmissionTypes.length === 1 && <span className="text-red-500">*</span>}
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Nhập nội dung bài nộp..."
            rows={10}
            disabled={disabled}
            required={allowedSubmissionTypes.length === 1 && allowedSubmissionTypes[0] === 'text'}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {allowedSubmissionTypes.length > 1
              ? "Bạn có thể nộp văn bản kết hợp với file hoặc link"
              : "Nhập nội dung bài nộp của bạn"
            }
          </p>
        </div>
      )}

      {/* File Upload (file, document, image, video) */}
      {(allowedSubmissionTypes.includes('file') ||
        allowedSubmissionTypes.includes('document') ||
        allowedSubmissionTypes.includes('image') ||
        allowedSubmissionTypes.includes('video')) && (
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
              {allowedSubmissionTypes.includes('document') && 'Tài liệu'}
              {allowedSubmissionTypes.includes('image') && 'Hình ảnh'}
              {allowedSubmissionTypes.includes('video') && 'Video'}
              {allowedSubmissionTypes.includes('file') && 'File'}
              {allowedSubmissionTypes.length === 1 && <span className="text-red-500">*</span>}
            </label>

            <div className="flex flex-col gap-4">
              <label className={`group relative w-full cursor-pointer flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-10 transition-all hover:border-primary hover:bg-primary/5 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-primary dark:hover:bg-primary/10 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <div className="flex flex-col items-center justify-center space-y-2 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 transition-colors group-hover:bg-white dark:bg-gray-800 dark:group-hover:bg-gray-700">
                    {isUploading ? (
                      <ArrowPathIcon className="h-6 w-6 text-primary animate-spin" />
                    ) : (
                      <CloudArrowUpIcon className="h-6 w-6 text-gray-400 transition-colors group-hover:text-primary" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      <span className="text-primary group-hover:underline">{isUploading ? 'Đang upload...' : 'Chọn file'}</span> hoặc kéo thả vào đây
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {allowedSubmissionTypes.includes('document') && 'PDF, Word, Excel, PowerPoint. '}
                      {allowedSubmissionTypes.includes('image') && 'JPG, PNG, GIF, WebP. '}
                      {allowedSubmissionTypes.includes('video') && 'MP4, AVI, MOV. '}
                      {allowedSubmissionTypes.includes('file') && 'Tất cả các định dạng file.'}
                    </p>
                  </div>
                </div>
                <input
                  type="file"
                  accept={getAcceptTypes()}
                  onChange={handleFileChange}
                  disabled={disabled || isUploading}
                  className="hidden"
                  required={allowedSubmissionTypes.length === 1 && !allowedSubmissionTypes.includes('text') && !allowedSubmissionTypes.includes('link') && !allowedSubmissionTypes.includes('audio')}
                />
              </label>

              {uploadedFile && (
                <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <DocumentArrowUpIcon className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[200px] sm:max-w-xs">
                        {uploadedFile.name}
                      </span>
                      {mediaId && (
                        <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                          ✓ Đã upload thành công
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    disabled={disabled}
                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-700 dark:hover:text-red-400 transition-colors"
                    title="Xóa file"
                  >
                    <span className="sr-only">Xóa</span>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      {/* Audio Recording */}
      {allowedSubmissionTypes.includes('audio') && (
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
            Ghi âm {allowedSubmissionTypes.length === 1 && <span className="text-red-500">*</span>}
          </label>
          <AudioRecorder
            onRecordingComplete={handleAudioComplete}
            disabled={disabled}
          />
          {mediaId && (
            <p className="mt-2 text-xs text-primary">
              ✓ Đã upload ghi âm thành công
            </p>
          )}
        </div>
      )}

      {/* Link Submission */}
      {allowedSubmissionTypes.includes('link') && (
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
            Liên kết (URL) {allowedSubmissionTypes.length === 1 && <span className="text-red-500">*</span>}
          </label>
          <div className="relative">
            <input
              type="url"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="https://example.com/file.pdf"
              disabled={disabled}
              required={allowedSubmissionTypes.length === 1 && allowedSubmissionTypes[0] === 'link'}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 pl-12 text-gray-900 placeholder-gray-500 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <LinkIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Nhập URL của file đính kèm (Google Drive, Dropbox, OneDrive, etc.)
          </p>
        </div>
      )}

      {/* Validation message */}
      {allowedSubmissionTypes.length > 1 && (
        <div className="rounded-lg bg-primary-pastel/40 border border-primary/30 p-3">
          <p className="text-sm text-primary">
            <strong>Lưu ý:</strong> Bạn có thể nộp bài bằng một hoặc nhiều định dạng được phép: {allowedSubmissionTypes.map(t => SUBMISSION_TYPE_LABELS[t]).join(', ')}
          </p>
        </div>
      )}
    </div>
  );
}
