"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon, SparklesIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import type {
  AiGeneratedQuestion,
  QuizQuestion,
  QuizQuestionOption,
  QuizQuestionType,
} from "@/lib/api-config";
import Button from "@/components/Common/Button";
import { useAiGenerateQuestions } from "@/hooks/use-api";
import { useNotification } from "@/hooks/use-notification";

type AiGenerateQuestionsDialogProps = {
  open: boolean;
  onClose: () => void;
  assignmentId: string;
  onAdd: (questions: QuizQuestion[]) => void;
  disabled?: boolean;
};

const QUESTION_TYPE_OPTIONS: { value: QuizQuestionType; label: string }[] = [
  { value: "single_choice", label: "Một đáp án đúng" },
  { value: "multiple_choice", label: "Nhiều đáp án đúng" },
  { value: "short_answer", label: "Trả lời ngắn" },
  { value: "true_false_not_given", label: "True / False / Not Given" },
  { value: "matching", label: "Nối thông tin (Matching)" },
  { value: "ordering", label: "Sắp xếp thứ tự (Ordering)" },
  { value: "gap_fill", label: "Điền vào chỗ trống (Gap fill)" },
];

const questionTypeLabel = (type: QuizQuestionType): string =>
  QUESTION_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;

/**
 * Map an AI-generated question onto the quiz-builder's QuizQuestion shape so it flows through
 * the normal add-question / validation / save path. Nothing is persisted here.
 */
const toQuizQuestion = (aiQuestion: AiGeneratedQuestion): QuizQuestion => {
  const aiItems = (aiQuestion.items || []) as Array<{ label?: string | null; content?: string | null }>;

  // Exam shapes carry their data in `items`/`text_with_gaps`, mirroring the backend normalizer.
  switch (aiQuestion.question_type) {
    case "true_false_not_given":
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title: aiQuestion.title,
        points: Number(aiQuestion.points) > 0 ? Number(aiQuestion.points) : 1,
        question_type: "true_false_not_given",
        options: [], // fixed choices auto-seeded server-side at save
      };
    case "matching":
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title: aiQuestion.title,
        points: Number(aiQuestion.points) > 0 ? Number(aiQuestion.points) : 1,
        question_type: "matching",
        // label = item text (left), content = correct match (right).
        options: aiItems
          .filter((item) => (item.label || "").trim() !== "" && (item.content || "").trim() !== "")
          .map((item) => ({
            label: item.label || "",
            content: item.content || "",
            is_correct: true,
          })),
        settings: (aiQuestion.distractors?.length ?? 0) > 0
          ? { distractors: aiQuestion.distractors }
          : undefined,
      };
    case "ordering":
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title: aiQuestion.title,
        points: Number(aiQuestion.points) > 0 ? Number(aiQuestion.points) : 1,
        question_type: "ordering",
        // Items arrive in the correct sequence; content = step text.
        options: aiItems
          .filter((item) => (item.content || "").trim() !== "")
          .map((item, idx) => ({
            label: String.fromCharCode(65 + idx),
            content: item.content || "",
            is_correct: true,
          })),
        settings: { partial_ordering: true },
      };
    case "gap_fill":
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title: aiQuestion.text_with_gaps || aiQuestion.title,
        points: Number(aiQuestion.points) > 0 ? Number(aiQuestion.points) : 1,
        question_type: "gap_fill",
        // label = gap number, content = accepted answer.
        options: aiItems
          .filter((item) => (item.label || "").trim() !== "" && (item.content || "").trim() !== "")
          .map((item) => ({
            label: item.label || "",
            content: item.content || "",
            is_correct: true,
          })),
      };
    default: {
      let source = aiQuestion.options || [];

      // Short answer: every option is an accepted answer (is_correct=true), matching the manual
      // builder's "accepted answers" editor. Prefer the AI-flagged correct ones; if none are flagged,
      // treat all returned options as accepted.
      if (aiQuestion.question_type === "short_answer") {
        const flagged = source.filter((opt) => opt.is_correct);
        source = (flagged.length > 0 ? flagged : source).map((opt) => ({ ...opt, is_correct: true }));
      }

      const options: QuizQuestionOption[] = source.map((opt, idx) => ({
        label: String.fromCharCode(65 + idx),
        content: opt.content,
        is_correct: Boolean(opt.is_correct),
      }));

      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title: aiQuestion.title,
        points: Number(aiQuestion.points) > 0 ? Number(aiQuestion.points) : 1,
        question_type: aiQuestion.question_type,
        options,
      };
    }
  }
};

export default function AiGenerateQuestionsDialog({
  open,
  onClose,
  assignmentId,
  onAdd,
  disabled = false,
}: AiGenerateQuestionsDialogProps) {
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState<string>("3");
  const [questionType, setQuestionType] = useState<QuizQuestionType>("single_choice");
  const [source, setSource] = useState("");
  const [generated, setGenerated] = useState<AiGeneratedQuestion[] | null>(null);
  const [addedKeys, setAddedKeys] = useState<Set<number>>(new Set());

  const { mutate: generateQuestions, loading } = useAiGenerateQuestions();
  const { success, error: showError } = useNotification();

  useEffect(() => {
    if (open) {
      const previousBodyOverflow = document.body.style.overflow;
      const previousHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previousBodyOverflow || "";
        document.documentElement.style.overflow = previousHtmlOverflow || "";
      };
    }
  }, [open]);

  const remaining = useMemo(
    () => (generated || []).filter((_, i) => !addedKeys.has(i)),
    [generated, addedKeys]
  );

  const resetResults = () => {
    setGenerated(null);
    setAddedKeys(new Set());
  };

  const handleClose = () => {
    setTopic("");
    setCount("3");
    setQuestionType("single_choice");
    setSource("");
    resetResults();
    onClose();
  };

  const handleGenerate = async () => {
    const parsedCount = parseInt(count, 10);
    if (!topic.trim()) {
      showError("Thiếu thông tin", "Vui lòng nhập chủ đề / yêu cầu cho AI.");
      return;
    }
    if (isNaN(parsedCount) || parsedCount < 1 || parsedCount > 10) {
      showError("Số lượng không hợp lệ", "Số câu hỏi phải từ 1 đến 10.");
      return;
    }

    resetResults();

    const result = await generateQuestions(assignmentId, {
      topic: topic.trim(),
      count: parsedCount,
      question_type: questionType,
      source: source.trim() || undefined,
    });

    if (result.success && result.data?.questions) {
      setGenerated(result.data.questions);
      if (result.data.questions.length === 0) {
        showError("Không có câu hỏi", "AI không tạo được câu hỏi nào. Vui lòng thử lại với chủ đề khác.");
      }
    } else if (!result.success && result.code !== "FEATURE_NOT_AVAILABLE") {
      // Feature denials already surface a permission message; other AI errors get a toast.
      showError("Không thể tạo câu hỏi", result.message);
    }
  };

  const addQuestions = (questions: QuizQuestion[], indices: number[]) => {
    if (questions.length === 0) return;
    onAdd(questions);
    setAddedKeys((prev) => {
      const next = new Set(prev);
      indices.forEach((i) => next.add(i));
      return next;
    });
    success("Đã thêm", `Đã thêm ${questions.length} câu hỏi vào bài. Nhớ lưu bài để hoàn tất.`);
  };

  const handleAddOne = (index: number) => {
    const aiQuestion = generated?.[index];
    if (!aiQuestion) return;
    addQuestions([toQuizQuestion(aiQuestion)], [index]);
  };

  const handleAddAll = () => {
    if (!generated) return;
    const indices = generated
      .map((_, i) => i)
      .filter((i) => !addedKeys.has(i));
    const questions = indices.map((i) => toQuizQuestion(generated[i]));
    addQuestions(questions, indices);
  };

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-3 backdrop-blur-[1px] sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-generate-questions-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700 sm:px-6 sm:py-4">
          <h3
            id="ai-generate-questions-title"
            className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white sm:text-lg"
          >
            <SparklesIcon className="h-5 w-5 text-violet-600" />
            Tạo câu hỏi bằng AI
          </h3>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:space-y-6 sm:px-6 sm:py-6">
          {/* Config form */}
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-white">
                Chủ đề / yêu cầu <span className="text-red-500">*</span>
              </label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Ví dụ: Phương trình bậc hai — nghiệm và định lý Vi-ét, mức độ lớp 9"
                rows={3}
                disabled={disabled || loading}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-primary focus:outline-none disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-white">
                  Số câu hỏi (1–10)
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                  disabled={disabled || loading}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-white">
                  Loại câu hỏi
                </label>
                <select
                  value={questionType}
                  onChange={(e) => setQuestionType(e.target.value as QuizQuestionType)}
                  disabled={disabled || loading}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  {QUESTION_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-white">
                Ngữ liệu tham khảo (tuỳ chọn)
              </label>
              <textarea
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Dán đoạn văn / tài liệu nguồn để AI bám sát nội dung (nếu có)."
                rows={2}
                disabled={disabled || loading}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-primary focus:outline-none disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              {generated && (
                <Button type="button" onClick={resetResults} variant="outline" size="sm" disabled={loading}>
                  Xoá kết quả
                </Button>
              )}
              <Button
                type="button"
                onClick={handleGenerate}
                variant="primary"
                size="sm"
                loading={loading}
                disabled={disabled || loading}
                icon={<SparklesIcon />}
              >
                {loading ? "AI đang tạo..." : "Tạo câu hỏi"}
              </Button>
            </div>
          </div>

          {/* Preview */}
          {generated && remaining.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                  Xem trước ({remaining.length} câu hỏi)
                </h4>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Chưa có gì được lưu cho đến khi bạn lưu bài.
                </span>
              </div>

              {generated.map((question, index) => {
                if (addedKeys.has(index)) return null;
                return (
                  <div
                    key={index}
                    className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-200">
                          {questionTypeLabel(question.question_type)} · {question.points} điểm
                        </span>
                        <p className="mt-1.5 text-sm font-medium text-gray-900 dark:text-white">
                          {question.title}
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={() => handleAddOne(index)}
                        variant="outline"
                        size="sm"
                        disabled={disabled || loading}
                      >
                        Thêm vào bài
                      </Button>
                    </div>
                    {/* Exam shapes: matching/ordering show item rows; gap_fill shows the text with gaps. */}
                    {question.question_type === "matching" && (question.items || []).length > 0 && (
                      <ul className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                        {(question.items || []).map((item, itemIdx) => (
                          <li key={itemIdx} className="flex items-start gap-2">
                            <span className="mt-0.5 h-4 w-4 flex-shrink-0" />
                            <span>
                              <span className="font-medium text-gray-900 dark:text-white">{item.label}</span>
                              {" → "}
                              <span className="text-green-700 dark:text-green-400">{item.content}</span>
                            </span>
                          </li>
                        ))}
                        {(question.distractors || []).length > 0 && (
                          <li className="text-xs text-gray-400 dark:text-gray-500">
                            + gây nhiễu: {question.distractors!.join(", ")}
                          </li>
                        )}
                      </ul>
                    )}
                    {question.question_type === "ordering" && (question.items || []).length > 0 && (
                      <ol className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                        {(question.items || []).map((item, itemIdx) => (
                          <li key={itemIdx} className="flex items-start gap-2">
                            <span className="font-semibold text-gray-400">{itemIdx + 1}.</span>
                            <span className="text-green-700 dark:text-green-400">{item.content}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                    {question.question_type === "true_false_not_given" && (
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        3 lựa chọn cố định TRUE / FALSE / NOT GIVEN sẽ được sinh tự động khi lưu.
                      </p>
                    )}
                    {(question.question_type === "gap_fill" || (question.text_with_gaps || "").trim() !== "") && (
                      <div className="mt-2 space-y-2">
                        {(question.text_with_gaps || question.title) && (
                          <p className="whitespace-pre-wrap rounded-lg bg-gray-50 p-2 text-sm text-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
                            {question.text_with_gaps || question.title}
                          </p>
                        )}
                        {(question.items || []).length > 0 && (
                          <ul className="space-y-1 text-sm">
                            {(question.items || []).map((item, itemIdx) => (
                              <li key={itemIdx} className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                  ({item.label})
                                </span>
                                <span className="text-green-700 dark:text-green-400">{item.content}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                    <ul className="space-y-1">
                      {(question.options || []).map((opt, optIdx) => (
                        <li
                          key={optIdx}
                          className={`flex items-start gap-2 text-sm ${
                            opt.is_correct
                              ? "text-green-700 dark:text-green-400"
                              : "text-gray-600 dark:text-gray-300"
                          }`}
                        >
                          {opt.is_correct ? (
                            <CheckCircleIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                          ) : (
                            <span className="mt-0.5 h-4 w-4 flex-shrink-0" />
                          )}
                          <span>{opt.content}</span>
                        </li>
                      ))}
                    </ul>
                    {question.explanation && (
                      <p className="mt-2 text-xs italic text-gray-500 dark:text-gray-400">
                        Giải thích: {question.explanation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {generated && remaining.length === 0 && generated.length > 0 && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
              Đã thêm tất cả câu hỏi vào bài. Bạn có thể tạo thêm hoặc đóng cửa sổ này.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse gap-3 border-t border-gray-200 px-4 py-3 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:px-6 sm:py-4">
          <Button type="button" onClick={handleClose} variant="outline" size="sm" disabled={loading}>
            Đóng
          </Button>
          {generated && remaining.length > 0 && (
            <Button
              type="button"
              onClick={handleAddAll}
              variant="primary"
              size="sm"
              disabled={disabled || loading}
            >
              Thêm tất cả ({remaining.length})
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
