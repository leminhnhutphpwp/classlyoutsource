"use client";

import { QuizSettings } from "@/lib/api-config";

type QuizSettingsFieldsProps = {
  value: QuizSettings;
  onChange: (value: QuizSettings) => void;
  disabled?: boolean;
  error?: string;
};

const DEFAULT_SETTINGS: QuizSettings = {
  auto_grade: true,
  shuffle_questions: false,
  show_correct_answers: false,
  show_score_to_student: true,
  time_limit_minutes: null,
};

const SETTINGS_CONFIG: Array<{
  key: keyof QuizSettings;
  label: string;
  description: string;
  type: "boolean" | "number";
}> = [
  {
    key: "auto_grade",
    label: "Chấm điểm tự động",
    description: "Tự động tính điểm ngay sau khi học viên nộp bài",
    type: "boolean",
  },
  {
    key: "shuffle_questions",
    label: "Xáo trộn thứ tự câu hỏi",
    description: "Mỗi học viên sẽ thấy thứ tự câu hỏi khác nhau",
    type: "boolean",
  },
  {
    key: "show_correct_answers",
    label: "Hiển thị đáp án đúng",
    description: "Cho phép học viên xem đáp án sau khi nộp (nếu được phép)",
    type: "boolean",
  },
  {
    key: "show_score_to_student",
    label: "Hiển thị điểm cho học viên",
    description: "Cho phép học viên xem điểm ngay sau khi nộp bài",
    type: "boolean",
  },
];

export default function QuizSettingsFields({
  value,
  onChange,
  disabled = false,
  error,
}: QuizSettingsFieldsProps) {
  const mergedValue = { ...DEFAULT_SETTINGS, ...(value || {}) };

  const handleToggle = (key: keyof QuizSettings) => {
    onChange({
      ...mergedValue,
      [key]: !mergedValue[key],
    });
  };

  const handleTimeLimitChange = (minutes: string) => {
    const parsed = minutes.trim() === "" ? null : Number(minutes);
    onChange({
      ...mergedValue,
      time_limit_minutes: Number.isFinite(parsed) && parsed !== null ? parsed : null,
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Cấu hình bài trắc nghiệm
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Tùy chỉnh cách hệ thống chấm điểm và hiển thị kết quả cho học viên.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {SETTINGS_CONFIG.map(({ key, label, description }) => (
          <label
            key={key}
            className={`flex items-start gap-3 rounded-2xl border p-4 transition-colors ${
              mergedValue[key]
                ? "border-primary bg-primary/5"
                : "border-gray-200 dark:border-gray-700"
            } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <input
              type="checkbox"
              checked={Boolean(mergedValue[key])}
              onChange={() => handleToggle(key)}
              disabled={disabled}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary dark:border-gray-600"
            />
            <span>
              <span className="font-medium text-gray-900 dark:text-white block">{label}</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">{description}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
        <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
          Giới hạn thời gian (phút)
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1}
            placeholder="Ví dụ: 30"
            value={mergedValue.time_limit_minutes ?? ""}
            onChange={(e) => handleTimeLimitChange(e.target.value)}
            disabled={disabled}
            className="w-32 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
          />
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Để trống nếu không giới hạn
          </span>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

