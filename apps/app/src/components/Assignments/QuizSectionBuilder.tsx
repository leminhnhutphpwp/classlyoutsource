"use client";

import { QuizQuestion, QuizMedia, QuizSectionDraft } from "@/lib/api-config";
import { PlusIcon, TrashIcon, DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import { useMemo, useState } from "react";
import Button from "@/components/Common/Button";
import InputGroup from "@/components/FormElements/InputGroup";
import QuestionMediaUpload from "@/components/Assignments/QuestionMediaUpload";
import QuizQuestionBuilder from "@/components/Assignments/QuizQuestionBuilder";

type QuizSectionBuilderProps = {
  questions: QuizQuestion[];
  onChangeQuestions: (value: QuizQuestion[]) => void;
  sections: QuizSectionDraft[];
  onChangeSections: (value: QuizSectionDraft[]) => void;
  disabled?: boolean;
  error?: string;
  assignmentId?: string;
};

const SECTION_TYPES: Array<{ value: QuizSectionDraft["section_type"]; label: string }> = [
  { value: "general", label: "Chung" },
  { value: "listening", label: "Listening (Nghe)" },
  { value: "reading", label: "Reading (Đọc)" },
  { value: "writing", label: "Writing (Viết)" },
  { value: "speaking", label: "Speaking (Nói)" },
];

const makeSectionKey = () => `sec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const createSection = (order: number): QuizSectionDraft => ({
  _key: makeSectionKey(),
  section_type: "general",
  title: `Phần ${order}`,
  instruction: "",
  media_id: null,
  media: null,
  order,
});

/**
 * Section-aware question builder: wraps the flat QuizQuestionBuilder per section.
 * Each section owns the questions tagged with its client `_key` (`section_key` is
 * resolved against `sections.*._key` server-side). A single-section draft behaves
 * like a flat quiz.
 */
export default function QuizSectionBuilder({
  questions,
  onChangeQuestions,
  sections,
  onChangeSections,
  disabled = false,
  error,
  assignmentId,
}: QuizSectionBuilderProps) {
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const questionsBySection = useMemo(() => {
    const map = new Map<string, QuizQuestion[]>();
    questions.forEach((question) => {
      const key = (question as QuizQuestion & { section_key?: string }).section_key || "";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(question);
    });
    return map;
  }, [questions]);

  const addSection = () => {
    const next = [...sections, createSection(sections.length + 1)];
    onChangeSections(next);
  };

  const duplicateSection = (index: number) => {
    const source = sections[index];
    const clone: QuizSectionDraft = {
      ...source,
      _key: makeSectionKey(),
      title: `${source.title} (Bản sao)`,
      order: sections.length + 1,
    };
    // Copy the section's questions (fresh client ids).
    const sourceQuestions = (questionsBySection.get(source._key) || []).map((q) => ({
      ...q,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      section_key: clone._key,
    }));
    onChangeSections([...sections, clone]);
    onChangeQuestions([
      ...questions,
      ...sourceQuestions,
    ]);
  };

  const removeSection = (index: number) => {
    const removed = sections[index];
    // Flat questions previously in this section fall out of every section panel and
    // would orphan — block removal until its questions are moved/deleted.
    const remaining = questions.filter(
      (q) => (q as QuizQuestion & { section_key?: string }).section_key !== removed._key
    );
    if (remaining.length !== questions.length) {
      const confirmDrop = window.confirm(
        `Xóa "${removed.title}" sẽ xóa toàn bộ câu hỏi trong phần này. Tiếp tục?`
      );
      if (!confirmDrop) return;
    }
    onChangeSections(sections.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i + 1 })));
    onChangeQuestions(remaining);
  };

  const updateSection = (index: number, patch: Partial<QuizSectionDraft>) => {
    onChangeSections(sections.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const handleSectionQuestionsChange = (sectionKey: string, sectionQuestions: QuizQuestion[]) => {
    const others = questions.filter(
      (q) => (q as QuizQuestion & { section_key?: string }).section_key !== sectionKey
    );
    const tagged = sectionQuestions.map((q) => ({ ...q, section_key: sectionKey }));
    onChangeQuestions([...others, ...tagged]);
  };

  return (
    <div className="space-y-6">
      {sections.map((section, index) => {
        const sectionQuestions = questionsBySection.get(section._key) || [];
        const sectionPoints = sectionQuestions.reduce(
          (sum, q) => sum + (Number(q.points) || 0),
          0
        );
        return (
          <div
            key={section._key}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverKey(section._key);
            }}
            onDragLeave={() => setDragOverKey(null)}
            className={`rounded-2xl border-2 p-4 transition-colors ${
              dragOverKey === section._key
                ? "border-primary bg-primary/5"
                : "border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-900/40"
            }`}
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <div className="flex-1">
                <InputGroup
                  label={`Tên phần thi ${index + 1}`}
                  name={`section-title-${section._key}`}
                  type="text"
                  value={section.title}
                  handleChange={(e) => updateSection(index, { title: e.target.value })}
                  placeholder="VD: Part 1 - Questions 1-10"
                  disabled={disabled}
                />
              </div>
              <div className="w-full lg:w-52">
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Loại kỹ năng
                </label>
                <select
                  value={section.section_type}
                  disabled={disabled}
                  onChange={(e) =>
                    updateSection(index, { section_type: e.target.value as QuizSectionDraft["section_type"] })
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                >
                  {SECTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-none gap-1.5 pb-0.5">
                <button
                  type="button"
                  onClick={() => duplicateSection(index)}
                  disabled={disabled}
                  title="Nhân đôi phần thi"
                  className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <DocumentDuplicateIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => removeSection(index)}
                  disabled={disabled || sections.length <= 1}
                  title="Xóa phần thi"
                  className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/30"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Hướng dẫn làm bài (tuỳ chọn)
                </label>
                <textarea
                  rows={2}
                  value={section.instruction || ""}
                  disabled={disabled}
                  onChange={(e) => updateSection(index, { instruction: e.target.value })}
                  placeholder="VD: You will hear a conversation. Complete the notes below."
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Media cho phần thi (audio listening / ảnh đề)
                </label>
                <QuestionMediaUpload
                  accept="audio-image"
                  media={(section.media as QuizMedia | null | undefined) ?? null}
                  disabled={disabled}
                  onChange={({ media_id, media }) => updateSection(index, { media_id, media })}
                />
              </div>
            </div>

            <div className="mt-4">
              <QuizQuestionBuilder
                questions={sectionQuestions}
                onChange={(next) => handleSectionQuestionsChange(section._key, next)}
                disabled={disabled}
                error={undefined}
                assignmentId={assignmentId}
              />
            </div>

            <p className="mt-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
              {sectionQuestions.length} câu · {sectionPoints} điểm
            </p>
          </div>
        );
      })}

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <Button
        type="button"
        onClick={addSection}
        disabled={disabled}
        variant="outline"
        size="sm"
        icon={<PlusIcon />}
      >
        Thêm phần thi
      </Button>
    </div>
  );
}
