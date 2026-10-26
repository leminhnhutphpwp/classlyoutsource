"use client";

import { useEffect } from "react";
import { QuizQuestion } from "@/lib/api-config";
import { getObjId } from "@/lib/id-utils";
import RichTextDisplay from "@/components/Common/RichTextDisplay";
import QuizMediaDisplay from "@/components/Common/QuizMediaDisplay";
import { questionTypeDescriptor } from "@/components/Assignments/question-types/registry";
import type { QuizAnswerDraft } from "@/components/Assignments/question-types/types";

type QuizTakeFormProps = {
  questions: QuizQuestion[];
  answers: Record<string, QuizAnswerDraft>;
  onChange: (questionId: string, value: QuizAnswerDraft) => void;
  disabled?: boolean;
  /** Global question offset when rendering section-by-section (keeps numbering continuous). */
  startIndex?: number;
  /** Called with the first question's key after mount — lets the page scroll to a section. */
  registerFirstQuestion?: (questionKey: string) => void;
};

/**
 * Renders every question through the question-type registry. Adding a new exam
 * question type = one descriptor in question-types/registry.tsx, no edits here.
 */
export default function QuizTakeForm({
  questions,
  answers,
  onChange,
  disabled = false,
  startIndex = 0,
  registerFirstQuestion,
}: QuizTakeFormProps) {
  // Register this block's first question id so the page can scroll to it (section navigator).
  useEffect(() => {
    if (registerFirstQuestion && questions.length > 0) {
      registerFirstQuestion(getObjId(questions[0]) || "0");
    }
  }, [registerFirstQuestion, questions]);

  if (!questions.length) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center dark:border-gray-700">
        <p className="text-gray-600 dark:text-gray-300">
          Chưa có câu hỏi nào được cung cấp trong đề này.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {questions.map((question, index) => {
        const questionKey = getObjId(question) || String(index);
        const descriptor = questionTypeDescriptor(question.question_type);
        const draft = answers[questionKey] ?? null;
        const Take = descriptor.Take;

        return (
          <div
            key={questionKey}
            id={`quiz-question-${questionKey}`}
            className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-primary">
                  Câu {startIndex + index + 1}
                  <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                    {descriptor.label}
                  </span>
                </p>
                {/* Gap-fill renders its own text (title holds the exercise text). */}
                {question.question_type !== "gap_fill" ? (
                  question.title ? (
                    <RichTextDisplay
                      content={question.title}
                      className="mt-1 text-base font-semibold text-gray-900 dark:text-white"
                    />
                  ) : (
                    <h3 className="mt-1 text-base font-semibold text-gray-900 dark:text-white">
                      {`Câu hỏi #${index + 1}`}
                    </h3>
                  )
                ) : null}
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{descriptor.hint}</p>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {question.points} điểm
              </span>
            </div>

            {/* Question media: audio player (listening) under the prompt, or image (diagram/graph). */}
            <QuizMediaDisplay media={question.media} variant="question" />

            <Take
              question={question}
              draft={draft}
              onChange={(next) => onChange(questionKey, next)}
              disabled={disabled}
            />
          </div>
        );
      })}
    </div>
  );
}
