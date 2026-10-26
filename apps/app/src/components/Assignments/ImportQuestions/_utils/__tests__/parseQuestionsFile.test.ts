import { describe, expect, it } from "vitest";
import { parseCSVFile } from "@/components/Assignments/ImportQuestions/_utils/parseQuestionsFile";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Helper: the parser reads via FileReader, so feed it a File built from a string.
 */
function csvFile(content: string, name = "test.csv"): File {
  return new File([content], name, { type: "text/csv" });
}

const SAMPLE_CSV = readFileSync(
  join(process.cwd(), "public/samples/assignments/mau-cau-hoi-luyen-thi.csv"),
  "utf-8"
);

describe("parseCSVFile — exam question types", () => {
  it("parses the shipped exam sample CSV into all seven types", async () => {
    const questions = await parseCSVFile(new File([SAMPLE_CSV], "sample.csv"));

    expect(questions).toHaveLength(7);
    expect(questions.map((q) => q.question_type)).toEqual([
      "single_choice",
      "multiple_choice",
      "short_answer",
      "true_false_not_given",
      "matching",
      "ordering",
      "gap_fill",
    ]);
  });

  it("parses a single_choice row from option columns", async () => {
    const csv = [
      "question_type,câu hỏi,A,B,C,đáp án đúng,điểm",
      'single_choice,"2 + 2 = ?",3,4,5,B,2',
    ].join("\n");
    const questions = await parseCSVFile(csvFile(csv));

    expect(questions).toHaveLength(1);
    expect(questions[0].question_type).toBe("single_choice");
    expect(questions[0].points).toBe(2);
    expect(questions[0].options.find((o) => o.label === "B")?.is_correct).toBe(true);
  });

  it("parses multiple_choice with a set of correct letters", async () => {
    const csv = [
      "question_type,câu hỏi,A,B,C,đáp án đúng",
      'multiple_choice,"Chọn danh từ:",happiness,quickly,teacher,"A,C"',
    ].join("\n");
    const questions = await parseCSVFile(csvFile(csv));

    const correct = questions[0].options.filter((o) => o.is_correct);
    expect(correct.map((o) => o.label)).toEqual(["A", "C"]);
  });

  it("parses short_answer accepted answers from option columns", async () => {
    const csv = [
      "question_type,câu hỏi,A,B,đáp án đúng",
      'short_answer,"She ___ (be) here.",is,Hanoi,',
    ].join("\n");
    const questions = await parseCSVFile(csvFile(csv));

    expect(questions[0].question_type).toBe("short_answer");
    expect(questions[0].options.every((o) => o.is_correct)).toBe(true);
    expect(questions[0].options).toHaveLength(2);
  });

  it("parses tfng rows without option columns and keeps the correct flag", async () => {
    const csv = [
      "question_type,câu hỏi,đáp án đúng",
      'true_false_not_given,"The library opens at 9am.",FALSE',
    ].join("\n");
    const questions = await parseCSVFile(csvFile(csv));

    expect(questions[0].question_type).toBe("true_false_not_given");
    expect(questions[0].options).toEqual([]);
  });

  it("parses matching pairs with distractors", async () => {
    const csv = [
      "question_type,câu hỏi,đáp án đúng,điểm,items,distractors",
      'matching,"Nối thành phố với quốc gia",,3,"Hà Nội|Việt Nam;;Tokyo|Nhật Bản","Hàn Quốc"',
    ].join("\n");
    const questions = await parseCSVFile(csvFile(csv));

    expect(questions[0].question_type).toBe("matching");
    expect(questions[0].options).toEqual([
      { label: "Hà Nội", content: "Việt Nam", is_correct: true },
      { label: "Tokyo", content: "Nhật Bản", is_correct: true },
    ]);
    expect(questions[0].settings?.distractors).toEqual(["Hàn Quốc"]);
  });

  it("parses ordering steps as sequential correct options", async () => {
    const csv = [
      "question_type,câu hỏi,điểm,items",
      'ordering,"Sắp xếp các bước",2,"Đun nước;;Cho trà;;Rót nước"',
    ].join("\n");
    const questions = await parseCSVFile(csvFile(csv));

    expect(questions[0].question_type).toBe("ordering");
    expect(questions[0].options.map((o) => o.content)).toEqual(["Đun nước", "Cho trà", "Rót nước"]);
    expect(questions[0].settings?.partial_ordering).toBe(true);
  });

  it("parses gap_fill text with numbered gaps and answers", async () => {
    const csv = [
      "question_type,câu hỏi,điểm,items",
      'gap_fill,"She {{1}} a doctor. They {{2}} nurses.",2,"1|is;;2|are"',
    ].join("\n");
    const questions = await parseCSVFile(csvFile(csv));

    expect(questions[0].question_type).toBe("gap_fill");
    expect(questions[0].title).toContain("{{1}}");
    expect(questions[0].options).toEqual([
      { label: "1", content: "is", is_correct: true },
      { label: "2", content: "are", is_correct: true },
    ]);
  });

  it("reports the failing row when a typed row is invalid", async () => {
    const csv = [
      "question_type,câu hỏi,items",
      'matching,"Nối",mục|đúng', // single pair → invalid
    ].join("\n");
    await expect(parseCSVFile(csvFile(csv))).rejects.toThrow(/Dòng 2/);
  });
});
