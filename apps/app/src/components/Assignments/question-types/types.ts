import type { QuizQuestion } from "@/lib/api-config";
import type { ComponentType } from "react";

/**
 * Draft value a student builds per question type before submission:
 * - choice questions → option id (string)
 * - multiple choice → option ids (string[])
 * - short answer / TFNG by text → string
 * - matching / gap_fill → map item/gap → pick (Record<string, string>)
 * - ordering → ordered item ids (string[])
 */
export type QuizAnswerDraft = string | string[] | Record<string, string> | null;

export type TakeComponentProps = {
  question: QuizQuestion;
  draft: QuizAnswerDraft;
  onChange: (next: QuizAnswerDraft) => void;
  disabled?: boolean;
};

export type QuestionTypeDescriptor = {
  type: QuizQuestion['question_type'];
  /** Vietnamese label used in take/edit/review UI. */
  label: string;
  /** Short hint shown under the question prompt while taking. */
  hint: string;
  /** Renders the answer input for one question. */
  Take: ComponentType<TakeComponentProps>;
  /** Convert the draft to the API answer payload for POST /submissions. */
  buildAnswerPayload: (question: QuizQuestion, draft: QuizAnswerDraft) => Record<string, unknown>;
  /** Whether the student has provided anything for this question. */
  isAnswered: (draft: QuizAnswerDraft) => boolean;
};

export function isRecord(value: unknown): value is Record<string, string> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value);
}
