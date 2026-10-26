import type { QuizQuestion, QuizReviewPayload, QuizSection, QuizSectionType } from "@/lib/api-config";

/** Aggregated score for one skill (section_type bucket). */
export interface SkillScore {
  type: QuizSectionType | "general";
  label: string;
  earned: number;
  possible: number;
  percent: number; // 0..100, 0 when possible === 0
  passed: boolean; // ≥ 60%
}

export interface ScoreSummary {
  earned: number;
  possible: number;
  percent: number;
  grade: string; // xếp loại theo mức % đúng
  graded: boolean; // false when nothing has been scored yet (chờ chấm)
}

const SKILL_LABELS: Record<string, string> = {
  listening: "Listening",
  reading: "Reading",
  writing: "Writing",
  speaking: "Speaking",
  general: "Tổng hợp",
};

/** Vietnamese grade bands, mirroring P5's "Xếp loại" line. */
function gradeLabel(percent: number): string {
  if (percent >= 90) return "Xuất sắc";
  if (percent >= 75) return "Tốt";
  if (percent >= 60) return "Khá";
  if (percent >= 40) return "Trung bình";
  return "Cần cố gắng";
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Overall summary for the score hero: total earned vs possible across all gradable responses.
 */
export function computeScoreSummary(review: QuizReviewPayload): ScoreSummary {
  const maxByQuestion = new Map<string, number>();
  review.questions.forEach((q: QuizQuestion) => {
    maxByQuestion.set(q.id ?? "", q.points ?? 0);
  });

  let earned = 0;
  let possible = 0;
  review.responses.forEach((row) => {
    const max = row.max_points ?? maxByQuestion.get(row.question_id) ?? 0;
    possible += max;
    earned += row.score ?? 0;
  });

  return {
    earned: round1(earned),
    possible: round1(possible),
    percent: possible > 0 ? Math.round((earned / possible) * 100) : 0,
    grade: gradeLabel(possible > 0 ? (earned / possible) * 100 : 0),
    graded: possible > 0,
  };
}

/**
 * Per-skill aggregation: buckets responses by the section_type of the question's section.
 * Questions without a section (or unknown section id) fall into the "general" bucket so a
 * flat quiz still shows one card instead of an empty report.
 */
export function computeSkillScores(review: QuizReviewPayload): SkillScore[] {
  const sectionTypeById = new Map<string, QuizSectionType | "general">();
  (review.sections ?? []).forEach((section: QuizSection) => {
    sectionTypeById.set(section._id, section.section_type ?? "general");
  });

  const questionSectionById = new Map<string, string | null>();
  review.questions.forEach((q: QuizQuestion) => {
    questionSectionById.set(q.id ?? "", q.section_id ?? null);
  });

  const buckets = new Map<string, { earned: number; possible: number }>();
  const addTo = (key: string, earned: number, possible: number) => {
    const bucket = buckets.get(key) ?? { earned: 0, possible: 0 };
    bucket.earned += earned;
    bucket.possible += possible;
    buckets.set(key, bucket);
  };

  const maxByQuestion = new Map<string, number>();
  review.questions.forEach((q: QuizQuestion) => {
    maxByQuestion.set(q.id ?? "", q.points ?? 0);
  });

  review.responses.forEach((row) => {
    const sectionId = questionSectionById.get(row.question_id) ?? null;
    const type = (sectionId && sectionTypeById.get(sectionId)) || "general";
    const max = row.max_points ?? maxByQuestion.get(row.question_id) ?? 0;
    addTo(type, row.score ?? 0, max);
  });

  // Stable display order: the four exam skills first, then general.
  const order = ["listening", "reading", "writing", "speaking", "general"];

  return [...buckets.entries()]
    .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([type, bucket]) => {
      const percent = bucket.possible > 0 ? Math.round((bucket.earned / bucket.possible) * 100) : 0;
      return {
        type: type as QuizSectionType | "general",
        label: SKILL_LABELS[type] ?? type,
        earned: round1(bucket.earned),
        possible: round1(bucket.possible),
        percent,
        passed: percent >= 60,
      };
    });
}

export interface InsightLine {
  title: string;
  detail: string;
}

/**
 * "Điểm mạnh / Cần cải thiện" lines derived from per-section results: sections at ≥70% earned
 * go to strengths, below go to improvements. Un-gradable sections (no possible points, e.g. a
 * pending manual grade) are skipped on both sides.
 */
export function computeInsights(review: QuizReviewPayload): { strengths: InsightLine[]; improvements: InsightLine[] } {
  const skills = computeSkillScores(review);
  const strengths: InsightLine[] = [];
  const improvements: InsightLine[] = [];

  skills.forEach((skill) => {
    if (skill.possible <= 0) return; // nothing scored in this skill yet
    const line: InsightLine = {
      title: skill.label,
      detail: `Đúng ${skill.percent}% (${skill.earned}/${skill.possible} điểm)`,
    };
    if (skill.percent >= 70) {
      strengths.push(line);
    } else {
      improvements.push(line);
    }
  });

  return { strengths, improvements };
}
