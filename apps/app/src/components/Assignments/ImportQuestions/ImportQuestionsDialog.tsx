"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { QuizQuestion } from "@/lib/api-config";
import Button from "@/components/Common/Button";
import ImportQuestionsFileSelector from "./_components/ImportQuestionsFileSelector";
import ImportQuestionsPreview from "./_components/ImportQuestionsPreview";
import { parseQuestionsFile } from "./_utils/parseQuestionsFile";
import { useNotification } from "@/hooks/use-notification";

type ImportQuestionsDialogProps = {
  open: boolean;
  onClose: () => void;
  onImport: (questions: QuizQuestion[]) => void;
  disabled?: boolean;
};

export default function ImportQuestionsDialog({
  open,
  onClose,
  onImport,
  disabled = false,
}: ImportQuestionsDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedQuestions, setParsedQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { error: showError, success } = useNotification();

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

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setError(null);
    setLoading(true);
    setParsedQuestions([]);

    try {
      const questions = await parseQuestionsFile(file);
      setParsedQuestions(questions);
      if (questions.length === 0) {
        setError("Không tìm thấy câu hỏi hợp lệ trong file");
      }
    } catch (err: any) {
      setError(err.message || "Lỗi khi đọc file");
      showError("Lỗi", err.message || "Không thể đọc file. Vui lòng kiểm tra định dạng file.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveQuestion = (index: number) => {
    setParsedQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImport = () => {
    const validQuestions = parsedQuestions.filter((q) => {
      const hasTitle = q.title && q.title.trim().length > 0;
      const hasOptions = q.options && q.options.length >= 2;
      const hasCorrectAnswer = q.options?.some((opt) => opt.is_correct);
      return hasTitle && hasOptions && hasCorrectAnswer;
    });

    if (validQuestions.length === 0) {
      showError("Lỗi", "Không có câu hỏi hợp lệ để nhập");
      return;
    }

    onImport(validQuestions);
    success("Thành công", `Đã nhập ${validQuestions.length} câu hỏi`);
    handleClose();
  };

  const handleClose = () => {
    setSelectedFile(null);
    setParsedQuestions([]);
    setError(null);
    onClose();
  };

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center z-[1000] bg-black/50 backdrop-blur-[1px] p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-questions-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-lg border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 id="import-questions-title" className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
            Nhập câu hỏi từ file
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
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 space-y-4 sm:space-y-6">
          {/* Step 1: File Selector */}
          {!selectedFile && (
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3 sm:mb-4">
                Bước 1: Chọn file
              </h4>
              <ImportQuestionsFileSelector
                onFileSelect={handleFileSelect}
                disabled={disabled || loading}
              />
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="text-center py-6 sm:py-8">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}></div>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Đang đọc file...
              </p>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
              <p className="text-sm font-medium">Lỗi</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          )}

          {/* Step 2: Preview */}
          {selectedFile && !loading && parsedQuestions.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                  Bước 2: Xem trước ({parsedQuestions.length} câu hỏi)
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setParsedQuestions([]);
                    setError(null);
                  }}
                  className="text-sm text-primary hover:underline"
                >
                  Chọn file khác
                </button>
              </div>
              <ImportQuestionsPreview
                questions={parsedQuestions}
                onRemove={handleRemoveQuestion}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-3 px-4 py-3 sm:px-6 sm:py-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            type="button"
            onClick={handleClose}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            Đóng
          </Button>
          {parsedQuestions.length > 0 && (
            <Button
              type="button"
              onClick={handleImport}
              variant="primary"
              size="sm"
              disabled={disabled || loading}
            >
              Nhập vào ({parsedQuestions.length} câu hỏi)
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

