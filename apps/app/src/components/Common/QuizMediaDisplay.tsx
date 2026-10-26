"use client";

import { QuizMedia } from "@/lib/api-config";

type Variant = "question" | "option" | "section";

interface QuizMediaDisplayProps {
  media?: QuizMedia | null;
  /** "question" shows a larger preview, "option" a compact thumbnail. */
  variant?: Variant;
  className?: string;
}

/**
 * Renders a quiz question/option media attachment.
 * - `type === 'audio'` → an <audio controls> player (listening questions).
 * - otherwise → a responsive <img> (diagrams, graphs, image answers).
 *
 * The backend `media.url` is usable directly. Fails closed: renders nothing
 * when there is no media/url.
 */
export default function QuizMediaDisplay({
  media,
  variant = "question",
  className = "",
}: QuizMediaDisplayProps) {
  if (!media?.url) return null;

  if (media.type === "audio") {
    return (
      <audio
        controls
        preload="metadata"
        src={media.url}
        className={`mt-3 w-full max-w-md ${className}`}
      >
        Trình duyệt của bạn không hỗ trợ phát audio.
      </audio>
    );
  }

  const sizing =
    variant === "option"
      ? "max-h-40 max-w-full"
      : "max-h-80 max-w-full";
  return (
    <img
      src={media.url}
      alt={media.name || "Hình ảnh câu hỏi"}
      loading="lazy"
      className={`mt-3 rounded-lg border border-gray-200 object-contain dark:border-gray-700 ${sizing} ${className}`}
    />
  );
}
