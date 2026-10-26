"use client";

import { QuizQuestion, QuizQuestionOption } from "@/lib/api-config";
import { PlusIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon } from "@heroicons/react/24/outline";
import { useMemo } from "react";

type EditorProps = {
  question: QuizQuestion;
  disabled?: boolean;
  onChange: (patch: Partial<QuizQuestion>) => void;
};

/** Gap numbers present in the text, in order: {{1}}, {{2}}... */
function gapNumbersInText(text: string): number[] {
  const numbers: number[] = [];
  const regex = /\{\{(\d+)\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const n = Number(match[1]);
    if (!numbers.includes(n)) numbers.push(n);
  }
  return numbers;
}

/* ------------------------------------------------------------------ */
/* True / False / Not Given — nothing to configure, the three choices   */
/* are constants the backend seeds automatically.                       */
/* ------------------------------------------------------------------ */
function TrueFalseNotGivenEditor({ onChange }: EditorProps) {
  // Ensure no stray options carry over when switching types.
  return (
    <div className="rounded-xl bg-primary/5 p-3 text-xs sm:text-sm text-primary">
      <p className="font-medium">Dạng câu hỏi True / False / Not Given</p>
      <p className="mt-1">
        Học sinh chọn một trong ba lựa chọn cố định: True, False, Not Given. Nhập đoạn văn bản
        (statement) vào ô nội dung câu hỏi phía trên.
      </p>
      <button
        type="button"
        onClick={() => onChange({ options: [] })}
        className="hidden"
        aria-hidden="true"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Matching — rows of (item → correct match), plus distractors         */
/* ------------------------------------------------------------------ */
function MatchingEditor({ question, disabled, onChange }: EditorProps) {
  const items = question.options || [];
  const distractors = useMemo(
    () => Array.isArray(question.settings?.distractors) ? (question.settings!.distractors as string[]) : [],
    [question.settings]
  );

  const setItems = (next: QuizQuestionOption[]) => onChange({ options: next });

  const updateItem = (index: number, patch: Partial<QuizQuestionOption>) => {
    const next = items.map((item, i) => (i === index ? { ...item, ...patch } : item));
    setItems(next);
  };

  const addItem = () => setItems([...items, { label: "", content: "", is_correct: true }]);

  const removeItem = (index: number) =>
    setItems(items.filter((_, i) => i !== index));

  const updateDistractors = (next: string[]) =>
    onChange({ settings: { ...(question.settings || {}), distractors: next.filter((d) => d.trim() !== "") } });

  return (
    <div className="space-y-3">
      <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
        Cặp nối: mục (cột trái) → thông tin đúng (cột phải)
      </p>
      {items.map((item, index) => (
        <div
          key={index}
          className="flex flex-col gap-2 rounded-xl border border-primary/40 bg-primary/5 p-2.5 sm:flex-row sm:items-center sm:gap-3"
        >
          <span className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {index + 1}
          </span>
          <input
            value={item.label || ""}
            onChange={(e) => updateItem(index, { label: e.target.value })}
            disabled={disabled}
            placeholder="Nội dung mục (VD: Địa danh)"
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <span className="hidden text-gray-400 sm:inline">→</span>
          <input
            value={item.content || ""}
            onChange={(e) => updateItem(index, { content: e.target.value })}
            disabled={disabled}
            placeholder="Thông tin đúng (VD: Paris)"
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <button
            type="button"
            onClick={() => removeItem(index)}
            disabled={disabled || items.length <= 1}
            className="h-8 w-full flex-none sm:w-auto inline-flex items-center justify-center rounded-lg border border-gray-300 px-2 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 disabled:opacity-40"
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        disabled={disabled || items.length >= 20}
        className="inline-flex items-center gap-2 rounded-lg border border-dashed border-primary px-3 py-2 text-xs sm:text-sm font-medium text-primary hover:bg-primary/5 disabled:opacity-40"
      >
        <PlusIcon className="h-3.5 w-3.5" />
        Thêm cặp nối
      </button>

      <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
          Dạng gây nhiễu (tuỳ chọn) — thêm lựa chọn sai vào danh sách chọn
        </p>
        <div className="mt-2 space-y-2">
          {distractors.map((distractor, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                value={distractor}
                onChange={(e) =>
                  updateDistractors(distractors.map((d, i) => (i === index ? e.target.value : d)))
                }
                disabled={disabled}
                placeholder="Lựa chọn gây nhiễu"
                className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
              <button
                type="button"
                onClick={() => updateDistractors(distractors.filter((_, i) => i !== index))}
                disabled={disabled}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => updateDistractors([...distractors, ""])}
            disabled={disabled}
            className="text-xs font-medium text-primary hover:underline"
          >
            + Thêm dạng gây nhiễu
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ordering — items in the correct sequence                             */
/* ------------------------------------------------------------------ */
function OrderingEditor({ question, disabled, onChange }: EditorProps) {
  const items = question.options || [];
  const partialOrdering = question.settings?.partial_ordering !== false;

  const setItems = (next: QuizQuestionOption[]) => onChange({ options: next });

  const updateItem = (index: number, patch: Partial<QuizQuestionOption>) => {
    setItems(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
        Thứ tự đúng (hệ thống sẽ xáo trộn khi giao cho học sinh)
      </p>
      {items.map((item, index) => (
        <div
          key={index}
          className="flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 p-2"
        >
          <span className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {index + 1}
          </span>
          <input
            value={item.content || ""}
            onChange={(e) => updateItem(index, { content: e.target.value })}
            disabled={disabled}
            placeholder={`Bước ${index + 1}`}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <button
            type="button"
            onClick={() => moveItem(index, -1)}
            disabled={disabled || index === 0}
            aria-label="Di chuyển lên"
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <ArrowUpIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => moveItem(index, 1)}
            disabled={disabled || index === items.length - 1}
            aria-label="Di chuyển xuống"
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <ArrowDownIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setItems(items.filter((_, i) => i !== index))}
            disabled={disabled || items.length <= 2}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setItems([...items, { label: String.fromCharCode(65 + items.length), content: "", is_correct: true }])}
        disabled={disabled || items.length >= 15}
        className="inline-flex items-center gap-2 rounded-lg border border-dashed border-primary px-3 py-2 text-xs sm:text-sm font-medium text-primary hover:bg-primary/5 disabled:opacity-40"
      >
        <PlusIcon className="h-3.5 w-3.5" />
        Thêm bước
      </button>

      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
        <input
          type="checkbox"
          checked={partialOrdering}
          disabled={disabled}
          onChange={(e) =>
            onChange({ settings: { ...(question.settings || {}), partial_ordering: e.target.checked } })
          }
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary dark:border-gray-600 dark:bg-gray-700"
        />
        Chấm điểm từng vị trí đúng (bỏ chọn để chỉ tính điểm khi đúng toàn bộ)
      </label>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Gap fill — text with {{n}} placeholders + accepted answers per gap   */
/* ------------------------------------------------------------------ */
function GapFillEditor({ question, disabled, onChange }: EditorProps) {
  // The exercise text lives in the question title (backend contract).
  const text = question.title || "";
  const gaps = gapNumbersInText(text);

  // Accepted answers: options with label = gap number, is_correct = true.
  const answersFor = (gap: number): QuizQuestionOption[] =>
    (question.options || []).filter((o) => String(o.label) === String(gap) && o.is_correct !== false);

  const setAnswersFor = (gap: number, contents: string[]) => {
    const others = (question.options || []).filter((o) => String(o.label) !== String(gap));
    const mine = contents
      .filter((c) => c.trim() !== "")
      .map((c) => ({ label: String(gap), content: c, is_correct: true }));
    onChange({ options: [...others, ...mine] });
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-primary/5 p-3 text-xs sm:text-sm text-primary">
        <p className="font-medium">Cách tạo câu điền từ</p>
        <p className="mt-1">
          Trong nội dung câu hỏi phía trên, viết chỗ trống dưới dạng <code className="rounded bg-primary/10 px-1">{"{{1}}"}</code>,{" "}
          <code className="rounded bg-primary/10 px-1">{"{{2}}"}</code>... rồi nhập đáp án cho từng chỗ trống bên dưới.
        </p>
      </div>

      {gaps.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Chưa có chỗ trống nào — hãy thêm {"{{1}}"}, {"{{2}}"} vào nội dung câu hỏi.
        </p>
      ) : (
        gaps.map((gap) => (
          <div key={gap} className="rounded-xl border border-primary/40 bg-primary/5 p-3">
            <p className="text-xs font-bold uppercase text-primary">Chỗ trống ({gap})</p>
            <input
              value={answersFor(gap).map((a) => a.content).join(" | ")}
              onChange={(e) => setAnswersFor(gap, e.target.value.split("|"))}
              disabled={disabled}
              placeholder="Nhập các đáp án chấp nhận, cách nhau bởi dấu |"
              className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
        ))
      )}
    </div>
  );
}

export default function QuestionTypeEditor(props: EditorProps) {
  switch (props.question.question_type) {
    case "true_false_not_given":
      return <TrueFalseNotGivenEditor {...props} />;
    case "matching":
      return <MatchingEditor {...props} />;
    case "ordering":
      return <OrderingEditor {...props} />;
    case "gap_fill":
      return <GapFillEditor {...props} />;
    default:
      return null;
  }
}
