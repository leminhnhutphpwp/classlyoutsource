import { describe, expect, it } from "vitest";
import { QUESTION_TYPE_DESCRIPTORS } from "@/components/Assignments/question-types/registry";
import { buildTakeNavigator } from "@/components/Assignments/question-types/QuizSectionNavigator";
import type { QuizQuestion } from "@/lib/api-config";

/**
 * Regression: backend payloads (quiz/take, review) expose question ids under `_id`
 * (hashid) — NOT `id`. The payload builders and the take navigator must therefore
 * resolve ids via getObjId, otherwise question_id becomes undefined, JSON drops it,
 * and POST /submissions fails validation with "Lỗi xác thực dữ liệu" (422).
 */
describe("quiz take answer payloads (hashid _id)", () => {
  const question: QuizQuestion = {
    // Backend take payload: id is absent, _id carries the hashid.
    _id: "py9mxwv7za27qd38lq6knjdb",
    title: "Nghiệm của phương trình x + 2 = 5 là:",
    points: 1,
    question_type: "single_choice",
    options: [
      { _id: "opt-a", label: "A", content: "x = 2", is_correct: false },
      { _id: "opt-b", label: "B", content: "x = 3", is_correct: true },
    ],
  };

  it("single_choice payload carries the question hashid", () => {
    const payload = QUESTION_TYPE_DESCRIPTORS.single_choice.buildAnswerPayload(question, "opt-b");
    expect(payload).toEqual({ question_id: "py9mxwv7za27qd38lq6knjdb", option_id: "opt-b" });
  });

  it("multiple_choice payload carries the question hashid + chosen ids", () => {
    const payload = QUESTION_TYPE_DESCRIPTORS.multiple_choice.buildAnswerPayload(question, ["opt-a", "opt-b"]);
    expect(payload).toEqual({ question_id: "py9mxwv7za27qd38lq6knjdb", selected_option_ids: ["opt-a", "opt-b"] });
  });

  it("short_answer payload carries the question hashid + text", () => {
    const payload = QUESTION_TYPE_DESCRIPTORS.short_answer.buildAnswerPayload(question, "x = 3");
    expect(payload).toEqual({ question_id: "py9mxwv7za27qd38lq6knjdb", text: "x = 3" });
  });

  it("buildTakeNavigator keeps questions that only have _id", () => {
    const { questions } = buildTakeNavigator(
      [{ _id: "s1", title: "Phần I", section_type: "general", order: 1 }],
      [{ _id: "py9mxwv7za27qd38lq6knjdb", section_id: "s1" }],
      () => true
    );
    expect(questions).toHaveLength(1);
    expect(questions[0].id).toBe("py9mxwv7za27qd38lq6knjdb");
    expect(questions[0].answered).toBe(true);
  });
});
