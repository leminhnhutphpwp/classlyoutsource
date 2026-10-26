import { describe, expect, it } from "vitest";
import {
  CEFR_BANDS,
  convertScore,
  cefrForScore,
  validateScore,
} from "@/components/Assignments/question-types/score-conversion";

describe("validateScore", () => {
  it("accepts in-scale scores", () => {
    expect(validateScore(65, "PTE")).toBeNull();
    expect(validateScore(7, "IELTS")).toBeNull();
    expect(validateScore(860, "TOEIC")).toBeNull();
    expect(validateScore(115, "DET")).toBeNull();
  });

  it("rejects out-of-range with the P17 error wording", () => {
    expect(validateScore(95, "PTE")).toContain("nằm trong khoảng 10 - 90");
    expect(validateScore(9.5, "IELTS")).toContain("nằm trong khoảng");
    expect(validateScore(1000, "TOEIC")).toContain("nằm trong khoảng");
  });

  it("enforces the 0.5 step for IELTS", () => {
    expect(validateScore(7.3, "IELTS")).toContain("bước 0.5");
    expect(validateScore(7.5, "IELTS")).toBeNull();
  });

  it("rejects non-numeric input", () => {
    expect(validateScore(NaN, "PTE")).toBeTruthy();
  });
});

describe("convertScore", () => {
  it("converts the wireframe example PTE 65 → IELTS 7.0 (C1)", () => {
    const result = convertScore(65, "PTE", "IELTS");
    expect(result.display).toBe("7.0");
    expect(result.cefr).toBe("C1");
  });

  it("converts PTE 65 → TOEIC 860–940 and DET 115–120", () => {
    expect(convertScore(65, "PTE", "TOEIC").display).toBe("860–940");
    expect(convertScore(65, "PTE", "DET").display).toBe("115–120");
  });

  it("returns null display when the target cert has no published band (TOEIC at C2)", () => {
    const result = convertScore(90, "PTE", "TOEIC");
    expect(result.cefr).toBe("C2");
    expect(result.display).toBeNull();
  });

  it("maps band edges inclusively (PTE 76 → C1+, PTE 75 → C1)", () => {
    expect(convertScore(76, "PTE", "IELTS").cefr).toBe("C1+");
    expect(convertScore(75, "PTE", "IELTS").cefr).toBe("C1");
  });

  it("handles open-ended TOEIC band (945+)", () => {
    expect(convertScore(990, "TOEIC", "PTE").cefr).toBe("C1+");
    expect(convertScore(990, "TOEIC", "PTE").display).toBe("76–84");
  });
});

describe("cefrForScore", () => {
  it("labels DET 115 as C1", () => {
    expect(cefrForScore(115, "DET")?.cefr).toBe("C1");
  });

  it("returns null for scores below the published table", () => {
    expect(cefrForScore(20, "PTE")).toBeNull();
  });
});

describe("CEFR_BANDS table integrity", () => {
  it("has strictly descending, non-overlapping band ranges per certificate (C2 → B2)", () => {
    for (const cert of ["pte", "ielts", "toeic", "det"] as const) {
      const rows = CEFR_BANDS.filter((b) => b[cert] !== null);
      for (let i = 1; i < rows.length; i++) {
        const higher = rows[i - 1][cert]!;
        const lower = rows[i][cert]!;
        // Table is ordered high → low: the next band must sit fully below the previous one.
        expect(lower.max).toBeLessThan(higher.min);
      }
    }
  });
});
