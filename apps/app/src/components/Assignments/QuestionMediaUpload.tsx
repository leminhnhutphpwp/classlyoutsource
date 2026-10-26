"use client";

import { useRef, useState } from "react";
import {
  PhotoIcon,
  MusicalNoteIcon,
  XMarkIcon,
  ArrowUpTrayIcon,
} from "@heroicons/react/24/outline";
import apiClient from "@/lib/api-client";
import { getObjId } from "@/lib/id-utils";
import { useToast } from "@/contexts/toast-context";
import { useUploadLimits } from "@/hooks/use-upload-limits";
import { QuizMedia } from "@/lib/api-config";
import QuizMediaDisplay from "@/components/Common/QuizMediaDisplay";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const AUDIO_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/aac",
  "audio/wav",
  "audio/x-wav",
];

type Accept = "image" | "audio-image";

interface QuestionMediaUploadProps {
  media?: QuizMedia | null;
  /** Called with the new attachment (or a cleared one). */
  onChange: (value: { media_id: number | null; media: QuizMedia | null }) => void;
  /** "audio-image" for questions (listening + diagrams), "image" for options. */
  accept?: Accept;
  disabled?: boolean;
  /** Compact layout for option-level image answers. */
  compact?: boolean;
}

/**
 * Thin picker that reuses the shared media upload pipeline
 * (`apiClient.uploadMediaFile` → `/api/media/upload` BFF). Stores the numeric
 * `media_id` for the payload and the returned `media` object for preview +
 * round-trip when editing.
 */
export default function QuestionMediaUpload({
  media,
  onChange,
  accept = "audio-image",
  disabled = false,
  compact = false,
}: QuestionMediaUploadProps) {
  const { addToast } = useToast();
  const { validateFileSize } = useUploadLimits();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const allowsAudio = accept === "audio-image";
  const acceptAttr = allowsAudio
    ? "image/jpeg,image/png,image/webp,image/gif,audio/*"
    : "image/jpeg,image/png,image/webp,image/gif";

  const triggerPicker = () => {
    if (disabled || isUploading) return;
    inputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;

    const isImage = IMAGE_TYPES.includes(file.type) || file.type.startsWith("image/");
    const isAudio = AUDIO_TYPES.includes(file.type) || file.type.startsWith("audio/");

    if (!isImage && !(allowsAudio && isAudio)) {
      addToast({
        type: "error",
        title: allowsAudio
          ? "Chỉ chấp nhận ảnh (JPG, PNG, WebP) hoặc audio (MP3, M4A, WAV)."
          : "Chỉ chấp nhận ảnh (JPG, PNG, WebP).",
      });
      return;
    }

    const sizeCheck = validateFileSize(file.size);
    if (!sizeCheck.valid) {
      addToast({ type: "error", title: sizeCheck.error || "File quá lớn." });
      return;
    }

    const fileType: "image" | "audio" = isAudio ? "audio" : "image";

    setIsUploading(true);
    try {
      const response = await apiClient.uploadMediaFile(file, fileType);
      const data = response?.data as
        | (Partial<QuizMedia> & { id?: number | string; download_url?: string; preview_url?: string })
        | undefined;
      const rawId = data?.id ?? getObjId(data);
      const numericId = Number(rawId);

      if (!response?.success || !rawId || !Number.isFinite(numericId)) {
        throw new Error(response?.message || "Tải lên thất bại.");
      }

      const mediaObj: QuizMedia = {
        id: String(rawId),
        // Prefer the server URL; fall back to a local object URL so the preview
        // shows instantly even if the upload response omits a url.
        url: data?.url || data?.download_url || data?.preview_url || URL.createObjectURL(file),
        type: (data?.type as string) || fileType,
        name: data?.name || file.name,
        ext: data?.ext || file.name.split(".").pop() || undefined,
      };

      onChange({ media_id: numericId, media: mediaObj });
      addToast({ type: "success", title: "Đã đính kèm media thành công." });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Lỗi khi tải lên. Vui lòng thử lại.";
      addToast({ type: "error", title: message });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    if (disabled) return;
    onChange({ media_id: null, media: null });
  };

  const hasMedia = !!media?.url;
  const buttonLabel = allowsAudio ? "Thêm ảnh/audio" : "Thêm ảnh";

  return (
    <div className={compact ? "" : "mt-3"}>
      <input
        ref={inputRef}
        type="file"
        accept={acceptAttr}
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || isUploading}
      />

      {hasMedia ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-2.5 dark:border-gray-700 dark:bg-gray-800/50">
          <QuizMediaDisplay media={media} variant={compact ? "option" : "question"} />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={triggerPicker}
              disabled={disabled || isUploading}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 disabled:opacity-40"
            >
              <ArrowUpTrayIcon className="h-3.5 w-3.5" />
              {isUploading ? "Đang tải..." : "Thay thế"}
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled || isUploading}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/30 disabled:opacity-40"
            >
              <XMarkIcon className="h-3.5 w-3.5" />
              Gỡ
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={triggerPicker}
          disabled={disabled || isUploading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-primary hover:text-primary dark:border-gray-600 dark:text-gray-300 dark:hover:border-primary disabled:opacity-40"
        >
          {allowsAudio ? (
            <MusicalNoteIcon className="h-3.5 w-3.5" />
          ) : (
            <PhotoIcon className="h-3.5 w-3.5" />
          )}
          {isUploading ? "Đang tải lên..." : buttonLabel}
        </button>
      )}
    </div>
  );
}
