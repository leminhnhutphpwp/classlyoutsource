"use client";

import { useMemo } from "react";
import { getObjId, idsEqual } from "@/lib/id-utils";
import type { QuizQuestion, QuizReviewPayload, QuizSection } from "@/lib/api-config";
import RichTextDisplay from "@/components/Common/RichTextDisplay";
import QuizMediaDisplay from "@/components/Common/QuizMediaDisplay";
import {
  CheckCircleIcon,
  XCircleIcon,
  MinusCircleIcon,
} from "@heroicons/react/24/outline";
import { questionTypeDescriptor } from "./registry";
import { isRecord, isStringArray } from "./types";

type ReviewResponse = QuizReviewPayload["responses"][number];

function ResponseBadge({ isCorrect, answered }: { isCorrect: boolean; answered: boolean }) {
  if (!answered) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
        <MinusCircleIcon className="h-3 w-3" />
        Bỏ trống
      </span>
    );
  }
  return isCorrect ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
      <CheckCircleIcon className="h-3 w-3" />
      Đúng
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300">
      <XCircleIcon className="h-3 w-3" />
      Sai
    </span>
  );
}

function OptionReviewList({
  question,
  selectedIds,
  correctIds,
  exposeCorrect,
}: {
  question: QuizQuestion;
  selectedIds: string[];
  correctIds: string[];
  exposeCorrect: boolean;
}) {
  return (
    <div className="mt-2 space-y-2">
      {(question.options || []).map((option) => {
        const optionId = getObjId(option) || "";
        const isSelected = selectedIds.some((sid) => idsEqual(optionId, sid));
        const isCorrectOption = exposeCorrect && correctIds.some((cid) => idsEqual(optionId, cid));
        return (
          <div
            key={optionId || option.content}
            className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${
              isCorrectOption
                ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                : isSelected
                  ? "border-primary/40 bg-primary/5"
                  : "border-gray-200 dark:border-gray-700"
            }`}
          >
            <span className="mt-0.5 flex-none font-semibold text-gray-500 dark:text-gray-400">
              {isSelected ? "✓" : "•"}
            </span>
            <div className="min-w-0 flex-1">
              {option.label ? (
                <span className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
                  {option.label}
                </span>
              ) : null}
              {option.content ? (
                <RichTextDisplay
                  content={option.content}
                  className="text-sm text-gray-900 dark:text-white"
                />
              ) : null}
            </div>
            {isCorrectOption ? (
              <span className="flex-none text-xs font-semibold text-green-700 dark:text-green-400">
                Đáp án
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function MatchingReview({
  question,
  response,
  exposeCorrect,
}: {
  question: QuizQuestion;
  response?: ReviewResponse;
  exposeCorrect: boolean;
}) {
  const picks = (isRecord(response?.response) ? response?.response.pairs : null) as
    | Record<string, string>
    | null;
  const itemResults = (response?.meta?.item_results ?? null) as Record<string, boolean> | null;

  return (
    <div className="mt-2 space-y-2">
      {(question.items || []).map((item, index) => {
        const itemId = item._id || `item-${index}`;
        const pick = picks?.[itemId] ?? picks?.[String(index)] ?? null;
        const isRight = itemResults ? Boolean(itemResults[itemId]) : null;
        return (
          <div
            key={itemId}
            className={`rounded-xl border px-3 py-2 text-sm ${
              isRight === true
                ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                : isRight === false
                  ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
                  : "border-gray-200 dark:border-gray-700"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <RichTextDisplay
                content={item.label || `Mục ${index + 1}`}
                className="min-w-0 flex-1 font-medium text-gray-900 dark:text-white"
              />
              <span className={pick ? "font-semibold text-primary" : "text-gray-400"}>
                {pick || "—"}
              </span>
            </div>
            {exposeCorrect && item.content ? (
              <p className="mt-1 text-xs text-green-700 dark:text-green-400">
                Đáp án: <span className="font-semibold">{item.content}</span>
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function OrderingReview({
  question,
  response,
  exposeCorrect,
}: {
  question: QuizQuestion;
  response?: ReviewResponse;
  exposeCorrect: boolean;
}) {
  const items = question.items || question.sequence_items || [];
  const stableItems = useMemo(() => items, [question.items, question.sequence_items]); // eslint-disable-line react-hooks/exhaustive-deps
  const studentSeq = isStringArray(response?.response as unknown as string[])
    ? (response?.response as unknown as string[])
    : ((isRecord(response?.response) ? response?.response.sequence : null) as string[] | null) || [];
  const positionResults = (response?.meta?.position_results ?? null) as boolean[] | null;

  const byId = useMemo(
    () => new Map(stableItems.map((item, index) => [item._id || `item-${index}`, item])),
    [stableItems]
  );
  // Correct order = items as stored (backend stores them in correct order before scrambling for students).
  const correctOrder = stableItems.map((item, index) => item._id || `item-${index}`);
  const studentOrder = studentSeq.length === stableItems.length ? studentSeq : [];

  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
        <p className="mb-2 text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
          Thứ tự của bạn
        </p>
        <ol className="space-y-1 text-sm">
          {(studentOrder.length ? studentOrder : correctOrder).map((id, index) => {
            const item = byId.get(id);
            const isRight = positionResults ? Boolean(positionResults[index]) : null;
            return (
              <li
                key={`${id}-${index}`}
                className={`rounded-lg px-2 py-1 ${
                  isRight === true
                    ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300"
                    : isRight === false
                      ? "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300"
                      : "text-gray-800 dark:text-gray-200"
                }`}
              >
                {index + 1}. {item?.content || "—"}
              </li>
            );
          })}
        </ol>
      </div>
      {exposeCorrect ? (
        <div className="rounded-xl border border-green-200 bg-green-50/50 p-3 dark:border-green-800 dark:bg-green-900/10">
          <p className="mb-2 text-xs font-bold uppercase text-green-700 dark:text-green-400">
            Đáp án đúng
          </p>
          <ol className="space-y-1 text-sm text-gray-800 dark:text-gray-200">
            {correctOrder.map((id, index) => (
              <li key={id}>
                {index + 1}. {byId.get(id)?.content || "—"}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

function GapFillReview({
  question,
  response,
  exposeCorrect,
}: {
  question: QuizQuestion;
  response?: ReviewResponse;
  exposeCorrect: boolean;
}) {
  const fills = (isRecord(response?.response) ? response?.response.fills : null) as
    | Record<string, string>
    | null;
  const gapResults = (response?.meta?.gap_results ?? null) as Record<string, boolean> | null;
  const correctGaps = (response?.meta?.correct_gaps ?? null) as Record<string, string> | null;
  const text = question.text_with_gaps || question.title || "";

  const parts = useMemo(() => {
    const segments: Array<{ type: "text" | "gap"; value: string | number }> = [];
    const regex = /\{\{(\d+)\}\}/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
      }
      segments.push({ type: "gap", value: Number(match[1]) });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
      segments.push({ type: "text", value: text.slice(lastIndex) });
    }
    return segments;
  }, [text]);

  return (
    <div className="mt-2 whitespace-pre-wrap rounded-xl border border-gray-200 bg-white p-4 text-sm leading-8 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
      {parts.map((part, index) => {
        if (part.type === "text") return <span key={index}>{part.value as string}</span>;
        const gap = part.value as number;
        const typed = fills?.[String(gap)] ?? "";
        const isRight = gapResults ? Boolean(gapResults[String(gap)]) : null;
        const correctText = exposeCorrect ? correctGaps?.[String(gap)] : null;
        return (
          <span key={index} className="mx-1 inline-flex flex-col items-center align-middle">
            <span
              className={`inline-block rounded-lg border px-2 py-0.5 text-center text-sm font-semibold ${
                isRight === true
                  ? "border-green-400 bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                  : isRight === false
                    ? "border-red-400 bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                    : "border-gray-300 text-gray-500 dark:border-gray-600"
              }`}
            >
              {typed || "___"}
            </span>
            {correctText ? (
              <span className="text-xs font-medium text-green-700 dark:text-green-400">
                {correctText}
              </span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

function QuestionReviewCard({
  question,
  response,
  index,
  exposeCorrect,
}: {
  question: QuizQuestion;
  response?: ReviewResponse;
  index: number;
  exposeCorrect: boolean;
}) {
  const descriptor = questionTypeDescriptor(question.question_type);
  const selectedIds = [
    ...(response?.selected_option_id ? [response.selected_option_id] : []),
    ...(response?.selected_option_ids || []),
  ];
  const correctIds = ((response?.meta?.correct_option_ids ?? []) as string[]) || [];
  const answered = response
    ? Boolean(response.selected_option_id) ||
      (response.selected_option_ids?.length ?? 0) > 0 ||
      (typeof response.text_answer === "string" && response.text_answer.trim() !== "") ||
      (isRecord(response.response) && Object.keys(response.response).length > 0) ||
      (isStringArray(response.response as unknown as string[]))
    : false;
  const score = Number(response?.score ?? 0);
  const maxPoints = Number(response?.max_points ?? question.points ?? 0);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-primary">
          Câu {index + 1}
          <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            {descriptor.label}
          </span>
        </p>
        <div className="flex items-center gap-2">
          <ResponseBadge isCorrect={Boolean(response?.is_correct)} answered={answered} />
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            {score}/{maxPoints} điểm
          </span>
        </div>
      </div>

      {question.question_type !== "gap_fill" && question.title ? (
        <RichTextDisplay
          content={question.title}
          className="mt-2 text-sm font-semibold text-gray-900 dark:text-white"
        />
      ) : null}
      <QuizMediaDisplay media={question.media} variant="question" />

      {question.question_type === "single_choice" || question.question_type === "multiple_choice" || question.question_type === "true_false_not_given" ? (
        <OptionReviewList
          question={question}
          selectedIds={selectedIds}
          correctIds={correctIds}
          exposeCorrect={exposeCorrect}
        />
      ) : null}
      {question.question_type === "short_answer" ? (
        <div className="mt-2 rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700">
          <p className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
            Câu trả lời
          </p>
          <p className="mt-1 text-gray-900 dark:text-white">
            {response?.text_answer || <span className="text-gray-400">Bỏ trống</span>}
          </p>
          {exposeCorrect && correctIds.length === 0 && response?.meta?.correct_answer ? (
            <p className="mt-1 text-xs text-green-700 dark:text-green-400">
              Đáp án: <span className="font-semibold">{String(response.meta.correct_answer)}</span>
            </p>
          ) : null}
        </div>
      ) : null}
      {question.question_type === "matching" ? (
        <MatchingReview question={question} response={response} exposeCorrect={exposeCorrect} />
      ) : null}
      {question.question_type === "ordering" ? (
        <OrderingReview question={question} response={response} exposeCorrect={exposeCorrect} />
      ) : null}
      {question.question_type === "gap_fill" ? (
        <GapFillReview question={question} response={response} exposeCorrect={exposeCorrect} />
      ) : null}
    </div>
  );
}

/**
 * Full quiz paper review: sections in exam order, each question re-rendered with the
 * student's answer and (when the backend says expose_correct) the answer key.
 */
export default function QuizReviewPanel({ review }: { review: QuizReviewPayload }) {
  const reviewSections = useMemo(() => review.sections || [], [review.sections]);
  const reviewQuestions = useMemo(() => review.questions || [], [review.questions]);
  const responsesByQuestion = useMemo(() => {
    const map = new Map<string, ReviewResponse>();
    (review.responses || []).forEach((row) => {
      map.set(String(row.question_id), row);
    });
    return map;
  }, [review.responses]);

  const groups: Array<{ section: QuizSection | null; questions: QuizQuestion[] }> = useMemo(() => {
    if (reviewSections.length === 0) {
      return reviewQuestions.length ? [{ section: null, questions: reviewQuestions }] : [];
    }
    return reviewSections.map((section) => ({
      section,
      questions: reviewQuestions.filter((q) => q.section_id && String(q.section_id) === String(section._id)),
    }));
  }, [reviewSections, reviewQuestions]);

  let questionCounter = 0;

  return (
    <div className="space-y-6">
      {groups.map(({ section, questions: groupQuestions }, groupIndex) => {
        const groupStart = questionCounter;
        questionCounter += groupQuestions.length;
        return (
          <div key={section?._id || `flat-${groupIndex}`} className="space-y-3">
            {section ? (
              <div className="rounded-2xl border border-primary/30 bg-primary-pastel/30 p-4 dark:border-primary/40 dark:bg-primary/10">
                <h4 className="text-base font-bold text-primary">{section.title}</h4>
                {section.instruction ? (
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{section.instruction}</p>
                ) : null}
                <QuizMediaDisplay media={section.media} variant="section" />
              </div>
            ) : null}
            {groupQuestions.map((question) => {
              const questionKey = getObjId(question) || "";
              const globalIndex = groupStart + groupQuestions.indexOf(question);
              return (
                <div key={questionKey} id={`quiz-question-${questionKey}`} className="scroll-mt-24">
                  <QuestionReviewCard
                    question={question}
                    response={responsesByQuestion.get(String(questionKey))}
                    index={globalIndex}
                    exposeCorrect={review.expose_correct}
                  />
                </div>
              );
            })}
          </div>
        );
      })}
      {!review.expose_correct ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Đáp án đúng sẽ được hiển thị sau khi giáo viên mở chế độ công bố đáp án.
        </p>
      ) : null}
    </div>
  );
}
