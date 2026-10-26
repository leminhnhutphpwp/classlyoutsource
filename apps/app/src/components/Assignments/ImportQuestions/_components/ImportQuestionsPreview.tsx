"use client";

import { QuizQuestion } from "@/lib/api-config";
import { CheckCircleIcon, XCircleIcon, TrashIcon } from "@heroicons/react/24/outline";
import RichTextDisplay from "@/components/Common/RichTextDisplay";

type ImportQuestionsPreviewProps = {
  questions: QuizQuestion[];
  onRemove?: (index: number) => void;
};

export default function ImportQuestionsPreview({
  questions,
  onRemove,
}: ImportQuestionsPreviewProps) {
  if (questions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center dark:border-gray-700">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Chưa có câu hỏi nào được import
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[400px] overflow-y-auto">
      {questions.map((question, index) => {
        const hasTitle = question.title && question.title.trim().length > 0;
        const hasOptions = question.options && question.options.length >= 2;
        const hasCorrectAnswer = question.options?.some((opt) => opt.is_correct);
        const isValid = hasTitle && hasOptions && hasCorrectAnswer;

        return (
          <div
            key={index}
            className={`rounded-lg border p-4 ${
              isValid
                ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    Câu hỏi #{index + 1}
                  </span>
                  {isValid ? (
                    <CheckCircleIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <XCircleIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
                  )}
                </div>
                <div className="space-y-1 text-sm">
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Nội dung: </span>
                    <span className="text-gray-900 dark:text-white">
                      {hasTitle ? (
                        <span className="line-clamp-2">
                          <RichTextDisplay content={question.title || ""} />
                        </span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400">(Thiếu nội dung)</span>
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Số phương án: </span>
                    <span className="text-gray-900 dark:text-white">
                      {question.options?.length || 0}
                      {!hasOptions && (
                        <span className="text-red-600 dark:text-red-400 ml-1">(Cần ít nhất 2)</span>
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Đáp án đúng: </span>
                    <span className="text-gray-900 dark:text-white">
                      {hasCorrectAnswer ? (
                        question.options
                          ?.filter((opt) => opt.is_correct)
                          .map((opt) => opt.label)
                          .join(", ") || "N/A"
                      ) : (
                        <span className="text-red-600 dark:text-red-400">(Thiếu đáp án đúng)</span>
                      )}
                    </span>
                  </div>
                  {question.points && (
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Điểm: </span>
                      <span className="text-gray-900 dark:text-white">{question.points}</span>
                    </div>
                  )}
                </div>
              </div>
              {onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="flex-shrink-0 h-8 w-8 inline-flex items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors"
                  title="Xóa khỏi danh sách"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

