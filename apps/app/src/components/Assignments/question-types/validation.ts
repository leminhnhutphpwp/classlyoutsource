import type { QuizQuestion } from "@/lib/api-config";
import { isRecord } from "./types";

/**
 * Per-type validation for the assignment builder. Returns a Vietnamese error message
 * for the first broken rule, or null when the question is complete.
 */
export function validateQuestionForType(question: QuizQuestion, displayIndex: number): string | null {
  const label = `Câu hỏi #${displayIndex}`;
  const options = question.options || [];

  switch (question.question_type) {
    case "gap_fill": {
      const gaps = [...question.title?.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1]);
      const uniqueGaps = [...new Set(gaps)];
      if (uniqueGaps.length === 0) {
        return `${label} (điền từ) chưa có chỗ trống — thêm {{1}}, {{2}}... vào nội dung.`;
      }
      for (const gap of uniqueGaps) {
        const accepted = options.filter((o) => String(o.label) === gap && o.is_correct !== false && o.content?.trim());
        if (accepted.length === 0) {
          return `${label} (điền từ) chưa có đáp án cho chỗ trống (${gap}).`;
        }
      }
      return null;
    }
    case "matching": {
      const pairs = options.filter((o) => o.label?.trim() && o.content?.trim());
      if (pairs.length < 2) {
        return `${label} (nối thông tin) cần ít nhất 2 cặp mục → thông tin đúng.`;
      }
      if (pairs.length < options.filter((o) => o.label?.trim()).length) {
        return `${label} (nối thông tin) có mục chưa nhập thông tin đúng.`;
      }
      return null;
    }
    case "ordering": {
      const steps = options.filter((o) => o.content?.trim());
      if (steps.length < 2) {
        return `${label} (sắp xếp) cần ít nhất 2 bước.`;
      }
      if (steps.length < options.length) {
        return `${label} (sắp xếp) có bước chưa có nội dung.`;
      }
      return null;
    }
    case "true_false_not_given": {
      return question.title?.trim() ? null : `${label} chưa có nội dung.`;
    }
    case "short_answer": {
      const accepted = options.filter((option) => option.content?.trim());
      return accepted.length < 1 ? `${label} cần ít nhất 1 đáp án được chấp nhận.` : null;
    }
    default: {
      const filled = options.filter((option) => option.content?.trim());
      if (filled.length < 2) {
        return `${label} cần ít nhất 2 phương án trả lời.`;
      }
      const correctCount = options.filter((option) => option.is_correct).length;
      const expected = question.question_type === "multiple_choice" ? 1 : 1;
      if (correctCount < expected) {
        return `${label} phải có ít nhất 1 đáp án đúng.`;
      }
      return null;
    }
  }
}

/**
 * Strip client-only/read-only fields before sending to the backend, keeping exactly
 * what POST/PUT assignments expects per question (including per-type option shapes).
 */
export function sanitizeQuestionForPayload(question: QuizQuestion, _index: number) {
  const sanitizedOptions = (question.options || [])
    .map((option, optionIndex) => {
      const cleaned = { ...option };
      delete cleaned.media; // send only media_id, not the read-only media object
      return {
        ...cleaned,
        label: option.label ?? String.fromCharCode(65 + optionIndex),
        content: option.content?.trim() || '',
        is_correct: Boolean(option.is_correct),
        media_id: option.media_id ?? null,
      };
    })
    // Keep options that have text OR an image answer (choice questions).
    .filter((option) => option.content.length > 0 || option.media_id != null);

  const cleanedQuestion: Record<string, unknown> = { ...question };
  delete cleanedQuestion.media;
  delete cleanedQuestion.items; // read-only transform from the backend
  delete cleanedQuestion.pool;
  delete cleanedQuestion.sequence_items;
  delete cleanedQuestion.text_with_gaps;
  delete cleanedQuestion.gap_numbers;
  delete cleanedQuestion.choices;
  delete cleanedQuestion.section_id; // send section_key instead (client temp key)
  delete cleanedQuestion.id; // client temp id — backend generates its own

  return {
    ...cleanedQuestion,
    title: question.title?.trim() || '',
    points: Number(question.points) || 0,
    question_type: question.question_type || 'single_choice',
    media_id: question.media_id ?? null,
    settings: isRecord(question.settings) && Object.keys(question.settings).length > 0
      ? question.settings
      : undefined,
    options: sanitizedOptions,
  };
}

/** Per-section sanitize — replaces the flat builder's inline logic for quiz mode. */
export function sanitizeSectionsForPayload(
  sections: Array<Record<string, unknown>>
): Array<Record<string, unknown>> {
  return sections.map((section) => {
    const cleaned: Record<string, unknown> = { ...section };
    delete cleaned.media; // send only media_id
    cleaned.title = String(cleaned.title ?? '').trim() || 'Phần thi';
    return cleaned;
  });
}
