import { describe, expect, it } from "vitest";
import {
  computeInsights,
  computeScoreSummary,
  computeSkillScores,
} from "@/components/Assignments/question-types/score-report";
import type { QuizReviewPayload } from "@/lib/api-config";

/** Minimal payload factory: sections bucket responses by section_type. */
function makeReview(overrides: Partial<QuizReviewPayload> = {}): QuizReviewPayload {
  return {
    submission: {} as QuizReviewPayload["submission"],
    assignment: {} as QuizReviewPayload["assignment"],
    sections: [
      { _id: "s1", section_type: "listening", title: "Part 1", order: 1 },
      { _id: "s2", section_type: "reading", title: "Passage 1", order: 2 },
    ] as QuizReviewPayload["sections"],
    questions: [
      { id: "q1", section_id: "s1", question_type: "gap_fill", points: 2 },
      { id: "q2", section_id: "s1", question_type: "true_false_not_given", points: 1 },
      { id: "q3", section_id: "s2", question_type: "matching", points: 3 },
      { id: "q4", section_id: "s2", question_type: "short_answer", points: 4 },
    ] as QuizReviewPayload["questions"],
    responses: [
      { question_id: "q1", score: 2, max_points: 2, is_correct: true },
      { question_id: "q2", score: 1, max_points: 1, is_correct: true },
      { question_id: "q3", score: 2.5, max_points: 3, is_correct: true },
      { question_id: "q4", score: null, max_points: 4, is_correct: false },
    ] as QuizReviewPayload["responses"],
    expose_correct: false,
    ...overrides,
  };
}

describe("computeScoreSummary", () => {
  it("sums earned/possible and derives percent + grade", () => {
    const summary = computeScoreSummary(makeReview());
    expect(summary.earned).toBe(5.5);
    expect(summary.possible).toBe(10);
    expect(summary.percent).toBe(55);
    expect(summary.grade).toBe("Trung bình");
    expect(summary.graded).toBe(true);
  });

  it("flags ungraded payloads (no possible points) as pending", () => {
    const summary = computeScoreSummary(makeReview({ responses: [] }));
    expect(summary.graded).toBe(false);
    expect(summary.grade).toBe("Cần cố gắng"); // 0/0 falls back to the lowest band
  });
});

describe("computeSkillScores", () => {
  it("buckets by section_type in exam-skill order", () => {
    const skills = computeSkillScores(makeReview());
    expect(skills.map((s) => s.type)).toEqual(["listening", "reading"]);

    const listening = skills[0];
    expect(listening.label).toBe("Listening");
    expect(listening.earned).toBe(3);
    expect(listening.possible).toBe(3);
    expect(listening.percent).toBe(100);
    expect(listening.passed).toBe(true);

    const reading = skills[1];
    expect(reading.earned).toBe(2.5);
    expect(reading.possible).toBe(7);
    expect(reading.percent).toBe(36);
    expect(reading.passed).toBe(false);
  });

  it("falls back to the general bucket for unsectioned quizzes", () => {
    const review = makeReview({ sections: [] });
    // Drop section ids so questions have no section.
    review.questions = review.questions.map((q) => ({ ...q, section_id: null })) as QuizReviewPayload["questions"];
    const skills = computeSkillScores(review);
    expect(skills).toHaveLength(1);
    expect(skills[0].type).toBe("general");
    expect(skills[0].label).toBe("Tổng hợp");
    expect(skills[0].earned).toBe(5.5);
    expect(skills[0].possible).toBe(10);
  });
});

describe("computeInsights", () => {
  it("splits sections at the 70% threshold and skips unscored ones", () => {
    const { strengths, improvements } = computeInsights(makeReview());
    expect(strengths.map((s) => s.title)).toEqual(["Listening"]);
    expect(improvements.map((s) => s.title)).toEqual(["Reading"]);
  });
});
