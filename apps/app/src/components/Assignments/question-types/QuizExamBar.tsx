"use client";

import { useEffect, useState } from "react";
import {
  CheckCircleIcon,
  ClockIcon,
  DocumentArrowUpIcon,
} from "@heroicons/react/24/outline";

/**
 * Sticky exam bar (trang 21 "Màn hình làm bài" của wireframe): timer + answered progress +
 * submit button pinned to the bottom of the viewport while the student works. Appears only
 * after the quiz starts; keeps the submit flow untouched (the form's own submit button and the
 * unanswered-confirmation modal still drive submission).
 */
export default function QuizExamBar({
  timeRemaining,
  timeExpired,
  elapsedSeconds,
  answered,
  total,
  submitting,
}: {
  /** Countdown when the quiz has a time limit; null otherwise. */
  timeRemaining: number | null;
  timeExpired: boolean;
  /** Elapsed time for untimed quizzes (shown instead of the countdown); null when timed. */
  elapsedSeconds: number | null;
  answered: number;
  total: number;
  submitting: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || total === 0) return null;

  const urgent = timeRemaining !== null && timeRemaining <= 60;
  const warning = timeRemaining !== null && timeRemaining <= 300 && !urgent;
  const allAnswered = answered >= total;

  const timerColor = timeExpired
    ? "text-red-600 dark:text-red-400"
    : urgent
      ? "text-red-600 dark:text-red-400"
      : warning
        ? "text-orange-600 dark:text-orange-400"
        : "text-primary";

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Countdown (timed) or elapsed clock (untimed) — exactly one of them renders.
  const clockSeconds = timeRemaining ?? elapsedSeconds;
  const clockPrefix = timeRemaining !== null ? null : elapsedSeconds !== null ? "Đã làm " : null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-3 sm:px-6 sm:pb-4">
      <div className="pointer-events-auto mx-auto flex max-w-3xl items-center gap-3 rounded-2xl border border-gray-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-800/95">
        {/* Countdown (timed quiz) or elapsed clock (untimed quiz) */}
        {clockSeconds !== null && !timeExpired && (
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <ClockIcon className={`h-5 w-5 ${timerColor}`} />
            <span className={`text-base font-bold tabular-nums ${timerColor}`}>
              {clockPrefix}
              {formatTime(clockSeconds)}
            </span>
          </div>
        )}
        {timeExpired && (
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <ClockIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
            <span className="text-base font-bold text-red-600 dark:text-red-400">Hết giờ</span>
          </div>
        )}

        {/* Answered progress */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <CheckCircleIcon
            className={`h-5 w-5 flex-shrink-0 ${allAnswered ? "text-green-600 dark:text-green-400" : "text-gray-400"}`}
          />
          <div className="min-w-0 flex-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
              <div
                className="h-1.5 rounded-full bg-primary transition-all"
                style={{ width: `${total > 0 ? Math.round((answered / total) * 100) : 0}%` }}
              />
            </div>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Đã trả lời {answered}/{total} câu
            </p>
          </div>
        </div>

        {/* Submit — `form` attribute triggers the quiz form's submit flow (confirm modal intact) */}
        <button
          type="submit"
          form="quiz-submit-form"
          disabled={submitting || timeExpired}
          className="flex flex-shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-50"
        >
          <DocumentArrowUpIcon className="h-5 w-5" />
          {submitting ? "Đang nộp..." : timeExpired ? "Đang tự nộp" : "Nộp bài"}
        </button>
      </div>
    </div>
  );
}
