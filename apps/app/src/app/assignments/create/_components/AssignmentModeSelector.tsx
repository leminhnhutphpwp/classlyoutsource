"use client";

type Props = {
  mode: "standard" | "quiz";
  onChange: (mode: "standard" | "quiz") => void;
};

const CARD_BASE =
  "rounded-2xl border p-4 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70";

export default function AssignmentModeSelector({ mode, onChange }: Props) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-900 dark:text-white">
        Hình thức bài tập
      </label>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={() => onChange("standard")}
          className={`${CARD_BASE} ${mode === "standard"
              ? "border-primary bg-primary/5 text-primary"
              : "border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-300"
            }`}
        >
          <p className="text-sm font-semibold">Bài tập thường</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Cho phép nộp văn bản, file hoặc liên kết.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onChange("quiz")}
          className={`${CARD_BASE} ${mode === "quiz"
              ? "border-primary bg-primary/5 text-primary"
              : "border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-300"
            }`}
        >
          <p className="text-sm font-semibold">Bài trắc nghiệm</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Tạo câu hỏi trắc nghiệm và hệ thống chấm điểm tự động.
          </p>
        </button>
      </div>
    </div>
  );
}

