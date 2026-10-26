"use client";

import { useMemo, useState } from "react";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import type { QuizQuestion, QuizReviewPayload, QuizReviewResponse } from "@/lib/api-config";
import { getObjId } from "@/lib/id-utils";
import Button from "@/components/Common/Button";
import { useGradeSubmission } from "@/hooks/use-api";
import { useNotification } from "@/hooks/use-notification";

/** A short-answer question with its resolved public id (hashid via _id). */
type ManualQuestion = { id: string; q: QuizQuestion };

/**
 * Per-question manual grading panel for quiz submissions (writing/speaking/short answers).
 * The tutor sees each question with its max points and the student's answer, enters a score,
 * and saves — the backend clamps each score against max_points and recomputes the submission
 * total from all rows, so auto-graded parts and manual parts always add up correctly.
 */
export default function QuizManualGrading({
  review,
  onGraded,
}: {
  review: QuizReviewPayload;
  /** Called after scores are saved so the parent can refetch submission + review data. */
  onGraded?: () => void;
}) {
  const { mutate: gradeSubmission, loading } = useGradeSubmission();
  const { success, error: showError } = useNotification();

  // Manual-gradable = short_answer rows with a resolvable id (free text).
  // Matching/ordering/gap_fill are auto-graded, no manual entry needed.
  const manualQuestions = useMemo<ManualQuestion[]>(
    () =>
      review.questions
        .filter((q) => q.question_type === "short_answer")
        .map((q) => ({ id: getObjId(q), q }))
        .filter((mq) => mq.id !== ""),
    [review.questions]
  );

  const responsesByQuestion = useMemo(() => {
    const map = new Map<string, QuizReviewResponse>();
    review.responses.forEach((r) => map.set(r.question_id, r));
    return map;
  }, [review.responses]);

  const [scores, setScores] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    manualQuestions.forEach(({ id }) => {
      const row = responsesByQuestion.get(id);
      initial[id] = row?.score !== null && row?.score !== undefined ? String(row.score) : "";
    });
    return initial;
  });

  const computeManualTotal = () => {
    let total = 0;
    let touched = false;
    manualQuestions.forEach(({ id, q }) => {
      const raw = scores[id]?.trim();
      const max = responsesByQuestion.get(id)?.max_points ?? q.points ?? 0;
      if (raw !== undefined && raw !== "") {
        const value = parseFloat(raw);
        if (!isNaN(value) && value >= 0) {
          total += Math.min(value, max || value);
          touched = true;
        }
      } else {
        total += responsesByQuestion.get(id)?.score ?? 0; // keep the stored row score
      }
    });
    return touched ? total : null;
  };

  const previewTotal = computeManualTotal();

  const handleSave = async () => {
    const questionScores: Record<string, number> = {};
    manualQuestions.forEach(({ id, q }) => {
      const raw = scores[id]?.trim();
      if (raw !== undefined && raw !== "") {
        const value = parseFloat(raw);
        if (isNaN(value) || value < 0) {
          showError("Điểm không hợp lệ", `Điểm của câu "${q.title.slice(0, 40)}" phải là số không âm.`);
          return;
        }
        questionScores[id] = value;
      }
    });

    if (Object.keys(questionScores).length === 0) {
      showError("Chưa nhập điểm", "Hãy nhập điểm cho ít nhất một câu hỏi.");
      return;
    }

    const result = await gradeSubmission(review.submission.id, {
      question_scores: questionScores,
      feedback: review.submission.feedback || undefined,
    });

    if (result.success) {
      success(
        "Đã lưu điểm",
        `Tổng điểm bài làm: ${result.data?.score ?? "?"} / ${review.submission.assignment?.max_score ?? "?"}`
      );
      onGraded?.();
    } else {
      showError("Không thể lưu điểm", result.message);
    }
  };

  if (manualQuestions.length === 0) {
    return null; // nothing manual to grade
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-500/30 dark:bg-amber-500/5 sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            Chấm từng câu ({manualQuestions.length} câu tự luận)
          </h4>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Điểm mỗi câu sẽ được giới hạn bởi điểm tối đa của câu đó; tổng điểm tự tính lại.
          </p>
        </div>
        <div className="text-right">
          <span className="block text-xs text-gray-500 dark:text-gray-400">Tổng dự kiến</span>
          <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
            {previewTotal !== null ? previewTotal : review.submission.score ?? 0}
            <span className="text-sm font-medium text-gray-400">
              {" / "}
              {review.submission.assignment?.max_score ?? "?"}
            </span>
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {manualQuestions.map(({ id, q }) => {
          const row = responsesByQuestion.get(id);
          const max = row?.max_points ?? q.points ?? 0;
          const answered = (row?.text_answer || "").trim() !== "";
          return (
            <div
              key={id}
              className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 flex-1 text-sm font-medium text-gray-900 dark:text-white">
                  {q.title}
                </p>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    max={max}
                    value={scores[id] ?? ""}
                    onChange={(e) => setScores((prev) => ({ ...prev, [id]: e.target.value }))}
                    placeholder="0"
                    className="w-20 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-right text-sm focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                  <span className="text-sm text-gray-400">/ {max}</span>
                </div>
              </div>
              {/* The student's answer, when they wrote one. */}
              {answered ? (
                <p className="mt-2 whitespace-pre-wrap rounded-lg bg-gray-50 p-2 text-sm text-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
                  {row?.text_answer}
                </p>
              ) : (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                  <XCircleIcon className="h-4 w-4" /> Học viên bỏ trống câu này
                </p>
              )}
              {review.expose_correct && Boolean(row?.meta?.ai_graded) && (
                <p className="mt-1 flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400">
                  <CheckCircleIcon className="h-4 w-4" /> Đã có gợi ý chấm AI cho câu này
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          type="button"
          variant="primary"
          size="sm"
          loading={loading}
          onClick={handleSave}
          icon={<ArrowPathIcon />}
        >
          Lưu điểm từng câu
        </Button>
      </div>
    </div>
  );
}
