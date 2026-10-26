"use client";

import type { QuizQuestion } from "@/lib/api-config";
import { getObjId } from "@/lib/id-utils";
import {
  ChoiceList,
  MultiChoiceList,
  ShortAnswerInput,
  MatchingBoard,
  OrderingBoard,
  GapFillText,
} from "./widgets";
import { isRecord, isStringArray } from "./types";
import type { QuestionTypeDescriptor, QuizAnswerDraft, TakeComponentProps } from "./types";

/* ------------------------------------------------------------------ */
/* Take components per question type                                   */
/* ------------------------------------------------------------------ */

function SingleChoiceTake({ question, draft, onChange, disabled }: TakeComponentProps) {
  return (
    <ChoiceList
      options={question.options || []}
      selectedId={typeof draft === "string" ? draft : null}
      onSelect={(id) => onChange(id)}
      disabled={disabled}
      namePrefix={`question-${getObjId(question)}`}
    />
  );
}

function MultipleChoiceTake({ question, draft, onChange, disabled }: TakeComponentProps) {
  const selectedIds = isStringArray(draft) ? draft : [];
  return (
    <MultiChoiceList
      options={question.options || []}
      selectedIds={selectedIds}
      onToggle={(optionId) => {
        const next = selectedIds.includes(optionId)
          ? selectedIds.filter((id) => id !== optionId)
          : [...selectedIds, optionId];
        onChange(next);
      }}
      disabled={disabled}
      namePrefix={`question-${getObjId(question)}`}
    />
  );
}

function ShortAnswerTake({ draft, onChange, disabled }: TakeComponentProps) {
  return (
    <ShortAnswerInput
      value={typeof draft === "string" ? draft : ""}
      onChange={(next) => onChange(next)}
      disabled={disabled}
    />
  );
}

function TrueFalseNotGivenTake({ question, draft, onChange, disabled }: TakeComponentProps) {
  // TFNG exposes its three fixed choices as real options — reuse the choice list.
  const options = (question.options || []).length
    ? question.options
    : (question.choices || []).map((choice, index) => ({
        id: `${getObjId(question)}-choice-${index}`,
        label: null,
        content: choice,
        is_correct: null,
      }));
  return (
    <ChoiceList
      options={options as QuizQuestion["options"]}
      selectedId={typeof draft === "string" ? draft : null}
      onSelect={(id) => onChange(id)}
      disabled={disabled}
      namePrefix={`question-${getObjId(question)}`}
      columns={3}
    />
  );
}

function MatchingTake({ question, draft, onChange, disabled }: TakeComponentProps) {
  const picks = isRecord(draft) ? draft : {};
  const items = question.items || [];
  const pool = question.pool || [];
  return (
    <MatchingBoard
      items={items}
      pool={pool}
      picks={picks}
      onPick={(itemId, choice) => {
        const next = { ...picks };
        if (choice) {
          next[itemId] = choice;
        } else {
          delete next[itemId];
        }
        onChange(next);
      }}
      disabled={disabled}
    />
  );
}

function OrderingTake({ question, draft, onChange, disabled }: TakeComponentProps) {
  const order = isStringArray(draft) ? draft : [];
  return (
    <OrderingBoard
      items={question.items || question.sequence_items || []}
      order={order}
      onOrderChange={(next) => onChange(next)}
      disabled={disabled}
    />
  );
}

function GapFillTake({ question, draft, onChange, disabled }: TakeComponentProps) {
  const fills = isRecord(draft) ? draft : {};
  return (
    <GapFillText
      text={question.text_with_gaps || question.title || ""}
      gaps={question.gap_numbers || []}
      fills={fills}
      onFill={(gap, value) => onChange({ ...fills, [String(gap)]: value })}
      disabled={disabled}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Answer payload builders                                             */
/* ------------------------------------------------------------------ */

function choicePayload(question: QuizQuestion, draft: QuizAnswerDraft) {
  return { question_id: getObjId(question), option_id: typeof draft === "string" && draft ? draft : null };
}

function multiPayload(question: QuizQuestion, draft: QuizAnswerDraft) {
  return { question_id: getObjId(question), selected_option_ids: isStringArray(draft) ? draft : [] };
}

function textPayload(question: QuizQuestion, draft: QuizAnswerDraft) {
  return { question_id: getObjId(question), text: typeof draft === "string" ? draft : "" };
}

function responsePayload(question: QuizQuestion, draft: QuizAnswerDraft) {
  return { question_id: getObjId(question), response: isRecord(draft) ? draft : isStringArray(draft) ? draft : {} };
}

function hasValue(value: string | undefined | null): boolean {
  return typeof value === "string" && value.trim() !== "";
}

/* ------------------------------------------------------------------ */
/* Registry — one entry per backend config/assignments.php question_types key */
/* ------------------------------------------------------------------ */

export const QUESTION_TYPE_DESCRIPTORS: Record<string, QuestionTypeDescriptor> = {
  single_choice: {
    type: "single_choice",
    label: "Trắc nghiệm một đáp án",
    hint: "Chọn một đáp án đúng",
    Take: SingleChoiceTake,
    buildAnswerPayload: choicePayload,
    isAnswered: (draft) => typeof draft === "string" && draft !== "",
  },
  multiple_choice: {
    type: "multiple_choice",
    label: "Trắc nghiệm nhiều đáp án",
    hint: "Chọn tất cả đáp án đúng",
    Take: MultipleChoiceTake,
    buildAnswerPayload: multiPayload,
    isAnswered: (draft) => isStringArray(draft) && draft.length > 0,
  },
  short_answer: {
    type: "short_answer",
    label: "Trả lời ngắn",
    hint: "Nhập câu trả lời của bạn",
    Take: ShortAnswerTake,
    buildAnswerPayload: textPayload,
    isAnswered: (draft) => typeof draft === "string" && draft.trim() !== "",
  },
  true_false_not_given: {
    type: "true_false_not_given",
    label: "True / False / Not Given",
    hint: "Chọn True, False hoặc Not Given",
    Take: TrueFalseNotGivenTake,
    buildAnswerPayload: choicePayload,
    isAnswered: (draft) => typeof draft === "string" && draft !== "",
  },
  matching: {
    type: "matching",
    label: "Nối thông tin (Matching)",
    hint: "Chọn thông tin phù hợp cho mỗi mục",
    Take: MatchingTake,
    buildAnswerPayload: responsePayload,
    isAnswered: (draft) => isRecord(draft) && Object.values(draft).some(hasValue),
  },
  ordering: {
    type: "ordering",
    label: "Sắp xếp thứ tự (Ordering)",
    hint: "Sắp xếp các mục theo đúng thứ tự",
    Take: OrderingTake,
    buildAnswerPayload: responsePayload,
    isAnswered: (draft) => isStringArray(draft) && draft.length > 0,
  },
  gap_fill: {
    type: "gap_fill",
    label: "Điền vào chỗ trống (Gap fill)",
    hint: "Điền từ thích hợp vào các chỗ trống",
    Take: GapFillTake,
    buildAnswerPayload: responsePayload,
    isAnswered: (draft) => isRecord(draft) && Object.values(draft).some(hasValue),
  },
};

export const KNOWN_QUESTION_TYPES = Object.keys(QUESTION_TYPE_DESCRIPTORS);

export function questionTypeDescriptor(type: string | undefined | null): QuestionTypeDescriptor {
  return (
    (type && QUESTION_TYPE_DESCRIPTORS[type]) ||
    QUESTION_TYPE_DESCRIPTORS.single_choice
  );
}
