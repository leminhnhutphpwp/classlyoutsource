"use client";

import { useMemo } from "react";
import { getObjId } from "@/lib/id-utils";
import type { QuizSection, QuizReviewPayload, QuizReviewResponse } from "@/lib/api-config";

type NavigatorMode = "take" | "review";

type NavigatorQuestion = {
  id: string;
  sectionKey: string;
  answered: boolean;
  correct: boolean | null; // review mode only
};

type NavigatorSection = { id: string; title: string };

type QuizSectionNavigatorProps = {
  mode: NavigatorMode;
  sections: NavigatorSection[];
  questions: NavigatorQuestion[];
};

/**
 * Compact section-grouped question grid (thẻ câu hỏi): click a card to scroll to that
 * question. In review mode the cards are color-coded (đúng / sai / chấm tay chờ).
 */
export default function QuizSectionNavigator({ mode, sections, questions }: QuizSectionNavigatorProps) {
  const grouped = useMemo(() => {
    const bySection = new Map<string, NavigatorQuestion[]>();
    questions.forEach((q) => {
      const list = bySection.get(q.sectionKey) ?? [];
      list.push(q);
      bySection.set(q.sectionKey, list);
    });
    return sections.map((section) => ({
      section,
      questions: bySection.get(section.id) ?? [],
    }));
  }, [sections, questions]);

  if (questions.length === 0) {
    return null;
  }

  const cardClass = (q: NavigatorQuestion): string => {
    if (mode === "review") {
      if (q.correct === true) {
        return "border-green-300 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-500/40 dark:bg-green-500/10 dark:text-green-400";
      }
      if (q.correct === false) {
        return "border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-400";
      }
      // No auto verdict (e.g. manual grading pending) — neutral amber.
      return "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-400";
    }
    return q.answered
      ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
      : "border-gray-300 bg-white text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700";
  };

  return (
    <nav aria-label="Điều hướng câu hỏi" className="space-y-3">
      {grouped.map(({ section, questions: sectionQuestions }) =>
        sectionQuestions.length === 0 ? null : (
          <div key={section.id}>
            {section.title && (
              <p className="mb-1.5 truncate text-xs font-medium text-gray-500 dark:text-gray-400" title={section.title}>
                {section.title}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {sectionQuestions.map((q, index) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => {
                    document
                      .getElementById(`quiz-question-${q.id}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                  title={mode === "review" ? undefined : q.answered ? "Đã trả lời" : "Chưa trả lời"}
                  className={`h-8 w-8 rounded-lg border text-xs font-semibold transition-colors ${cardClass(q)}`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
          </div>
        )
      )}
    </nav>
  );
}

/** Build take-mode navigator props from the submit page's state. */
export function buildTakeNavigator(
  sections: QuizSection[],
  questions: Array<{ id?: string; _id?: string; section_id?: string | null }>,
  isAnswered: (questionId: string) => boolean
): { sections: NavigatorSection[]; questions: NavigatorQuestion[] } {
  return {
    sections: sections.map((s) => ({ id: s._id, title: s.title })),
    questions: questions
      .map((q) => ({ id: getObjId(q), section_id: q.section_id }))
      .filter((q) => q.id !== "")
      .map((q) => ({
        id: q.id,
        sectionKey: q.section_id || sections[0]?._id || "default",
        answered: isAnswered(q.id),
        correct: null,
      })),
  };
}

/** Build review-mode navigator props from a QuizReviewPayload. */
export function buildReviewNavigator(review: QuizReviewPayload): {
  sections: NavigatorSection[];
  questions: NavigatorQuestion[];
} {
  const responsesByQuestion = new Map<string, QuizReviewResponse>();
  review.responses.forEach((r) => responsesByQuestion.set(r.question_id, r));

  return {
    sections: review.sections.map((s) => ({ id: s._id, title: s.title })),
    questions: review.questions
      .map((q) => ({ id: getObjId(q), question: q }))
      .filter(({ id }) => id !== "")
      .map(({ id, question: q }) => {
        const row = responsesByQuestion.get(id);
        // Auto-verdict only when the question is objectively gradable; manual rows stay amber.
        const gradable = q.question_type !== "short_answer";
        return {
          id,
          sectionKey: q.section_id || review.sections[0]?._id || "default",
          answered: (row?.text_answer || "").trim() !== "" || !!row?.selected_option_id ||
            (row?.selected_option_ids?.length ?? 0) > 0 || !!row?.response,
          correct: gradable ? Boolean(row?.is_correct) : null,
        };
      }),
  };
}
