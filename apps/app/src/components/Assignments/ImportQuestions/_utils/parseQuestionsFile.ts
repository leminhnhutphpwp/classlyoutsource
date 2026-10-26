import { QuizQuestion, QuizQuestionOption, QuizQuestionType } from "@/lib/api-config";

const TFNG_VALUES = ["TRUE", "FALSE", "NOT GIVEN"];

/**
 * Parse CSV file to QuizQuestion array.
 *
 * Supports the legacy single-choice layout (title + option columns A-D + correct-answer letter)
 * AND a `question_type` column that unlocks the exam shapes:
 *  - `multiple_choice`: `correct` holds a set like "A,C"
 *  - `short_answer`: `correct` holds the accepted answer (options fall back to it)
 *  - `true_false_not_given`: statement rows — `correct` ∈ TRUE/FALSE/NOT GIVEN, choices auto-seeded
 *  - `matching`: `items` = "item|match" pairs separated by `;;`, `distractors` = extra choices separated by `;;`
 *  - `ordering`: `items` = steps in the CORRECT order separated by `;;`
 *  - `gap_fill`: `title` holds the text with {{1}},{{2}}... and `items` = "gap#|answer" pairs separated by `;;`
 */
export async function parseCSVFile(file: File): Promise<QuizQuestion[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split("\n").filter((line) => line.trim());

        if (lines.length < 2) {
          reject(new Error("File CSV phải có ít nhất 1 dòng header và 1 dòng dữ liệu"));
          return;
        }

        // Parse CSV line - handle CSV with quotes and commas
        const parseCSVLine = (line: string): string[] => {
          const result: string[] = [];
          let current = "";
          let inQuotes = false;

          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = "";
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };

        // Parse header
        const header = parseCSVLine(lines[0]).map((h: string) => h.replace(/^"|"$/g, '').trim().toLowerCase());
        // Columns that carry metadata, never the question text (guarded against by title matching).
        const META_HEADERS = new Set(["question_type", "type", "loại", "loai"]);
        const findColumn = (predicates: ((h: string) => boolean)[]): number => {
          for (const predicate of predicates) {
            const index = header.findIndex(predicate);
            if (index !== -1) return index;
          }
          return -1;
        };

        const titleIndex = findColumn([
          (h) => h.includes("câu hỏi") || h.includes("nội dung") || h.includes("title") ||
            (h.includes("question") && !META_HEADERS.has(h)),
        ]);
        const typeIndex = findColumn([
          (h) => h === "question_type" || h === "loại" || h === "loai" || h === "type",
        ]);
        const correctIndex = findColumn([
          (h) => h.includes("đáp án đúng") || h.includes("correct") || h.includes("answer") || h.includes("đúng"),
        ]);
        const pointsIndex = findColumn([
          (h) => h.includes("điểm") || h.includes("points") || h.includes("score"),
        ]);
        const itemsIndex = findColumn([
          (h) => h === "items" || h === "cặp nối" || h === "cac buoc" || h.includes("bước") || h.includes("cặp") || h.includes("items"),
        ]);
        const distractorsIndex = findColumn([
          (h) => h.includes("distractor") || h.includes("gây nhiễu") || h.includes("gây nhiễu"),
        ]);

        // Find option columns (A, B, C, D, etc. or "Phương án A", "Phương án B", etc.)
        const optionIndices: number[] = [];
        for (let i = 0; i < header.length; i++) {
          const h = header[i];
          if (
            h.match(/^[a-j]$/i) ||
            h.includes("phương án") ||
            h.includes("option") ||
            h.match(/^option\s*[a-j]$/i) ||
            h.match(/^[a-j]\./i)
          ) {
            optionIndices.push(i);
          }
        }

        if (titleIndex === -1) {
          reject(new Error("Không tìm thấy cột 'Câu hỏi' hoặc 'Nội dung' trong file CSV"));
          return;
        }

        // Option columns are only mandatory for the legacy choice layout; typed rows validate later.
        const hasTypedRows = typeIndex !== -1;

        if (optionIndices.length < 2 && !hasTypedRows) {
          reject(new Error("Cần ít nhất 2 cột phương án (A, B, C, D) trong file CSV"));
          return;
        }

        // Parse data rows
        const questions: QuizQuestion[] = [];
        const errors: string[] = [];

        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]).map((v: string) => v.replace(/^"|"$/g, '').trim());
          const rowNumber = i + 1;

          if (!values[titleIndex] || !values[titleIndex].trim()) {
            continue;
          }

          const title = values[titleIndex];
          const points = pointsIndex !== -1 && values[pointsIndex]
            ? parseFloat(values[pointsIndex]) || 1
            : 1;
          const rawType = hasTypedRows ? (values[typeIndex] || "").toLowerCase().trim() : "";
          const questionType: QuizQuestionType = normalizeType(rawType);
          const correct = correctIndex !== -1 ? (values[correctIndex] || "").trim() : "";

          const parsed: QuizQuestion | null = buildQuestion({
            questionType,
            title,
            correct,
            points,
            rowNumber,
            values,
            optionIndices,
            itemsIndex,
            distractorsIndex,
          });

          if (parsed) {
            questions.push(parsed);
          } else if (lastRowError) {
            errors.push(lastRowError);
          }
        }

        if (questions.length === 0) {
          reject(new Error(
            errors.length > 0
              ? `Không nhập được câu hỏi nào:\n${errors.slice(0, 5).join("\n")}`
              : "Không đọc được câu hỏi nào từ file CSV."
          ));
          return;
        }

        resolve(questions);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error("Lỗi khi đọc file"));
    };

    reader.readAsText(file, "UTF-8");
  });
}

function normalizeType(raw: string): QuizQuestionType {
  switch (raw) {
    case "multiple":
    case "multiple_choice":
    case "multi":
      return "multiple_choice";
    case "short":
    case "short_answer":
    case "short answer":
    case "trả lời ngắn":
      return "short_answer";
    case "tfng":
    case "true_false_not_given":
    case "true false not given":
      return "true_false_not_given";
    case "matching":
    case "match":
    case "nối":
    case "noi":
      return "matching";
    case "ordering":
    case "order":
    case "sap xep":
    case "sắp xếp":
      return "ordering";
    case "gap":
    case "gap_fill":
    case "gap fill":
    case "điền từ":
    case "dien tu":
      return "gap_fill";
    default:
      return "single_choice";
  }
}

/** Per-row error scratch (used to surface which row failed and why). */
let lastRowError: string | null = null;

function buildQuestion(ctx: {
  questionType: QuizQuestionType;
  title: string;
  correct: string;
  points: number;
  rowNumber: number;
  values: string[];
  optionIndices: number[];
  itemsIndex: number;
  distractorsIndex: number;
}): QuizQuestion | null {
  lastRowError = null;
  const { questionType, title, correct, points, rowNumber, values, optionIndices } = ctx;
  const items = ctx.itemsIndex !== -1 ? (values[ctx.itemsIndex] || "") : "";
  const distractors = ctx.distractorsIndex !== -1 ? (values[ctx.distractorsIndex] || "") : "";
  const id = (Date.now() + Math.random() + rowNumber).toString();

  const fail = (message: string): null => {
    lastRowError = `Dòng ${rowNumber}: ${message}`;
    return null;
  };

  switch (questionType) {
    case "true_false_not_given": {
      if (correct && !TFNG_VALUES.includes(correct.toUpperCase())) {
        return fail(`true_false_not_given cần đáp án TRUE/FALSE/NOT GIVEN, nhận được "${correct}".`);
      }
      return { id, title, points, question_type: "true_false_not_given", options: [] };
    }

    case "matching": {
      const pairs = items.split(";;").map((pair) => pair.split("|"));
      const options: QuizQuestionOption[] = [];
      for (const [left, right] of pairs) {
        if (!left?.trim() || !right?.trim()) continue;
        options.push({ label: left.trim(), content: right.trim(), is_correct: true });
      }
      if (options.length < 2) {
        return fail("matching cần cột items dạng 'mục|đúng;;mục|đúng' với ít nhất 2 cặp.");
      }
      const question: QuizQuestion = { id, title, points, question_type: "matching", options };
      const extra = distractors.split(";;").map((d) => d.trim()).filter(Boolean);
      if (extra.length > 0) {
        question.settings = { distractors: extra };
      }
      return question;
    }

    case "ordering": {
      const steps = items.split(";;").map((s) => s.trim()).filter(Boolean);
      if (steps.length < 2) {
        return fail("ordering cần cột items dạng 'bước 1;;bước 2;;...' (theo đúng thứ tự) với ít nhất 2 bước.");
      }
      return {
        id,
        title,
        points,
        question_type: "ordering",
        options: steps.map((step, idx) => ({
          label: String.fromCharCode(65 + idx),
          content: step,
          is_correct: true,
        })),
        settings: { partial_ordering: true },
      };
    }

    case "gap_fill": {
      if (!/\{\{\d+\}\}/.test(title)) {
        return fail('gap_fill cần nội dung có chỗ trống {{1}}, {{2}}...');
      }
      const answers: QuizQuestionOption[] = [];
      for (const entry of items.split(";;")) {
        const [gap, answer] = entry.split("|");
        if (!gap?.trim() || !answer?.trim()) continue;
        answers.push({ label: gap.trim(), content: answer.trim(), is_correct: true });
      }
      if (answers.length === 0) {
        return fail("gap_fill cần cột items dạng '1|đáp án;;2|đáp án'.");
      }
      return { id, title, points, question_type: "gap_fill", options: answers };
    }

    case "short_answer": {
      // Accepted answers: option columns, or the `correct` column as the single accepted answer.
      const accepted = optionIndices
        .map((idx) => values[idx] || "")
        .filter((content) => content.trim() !== "")
        .map((content) => ({ label: "A", content, is_correct: true }));
      if (accepted.length === 0 && correct) {
        accepted.push({ label: "A", content: correct, is_correct: true });
      }
      if (accepted.length === 0) {
        return fail("short_answer cần ít nhất 1 đáp án được chấp nhận (cột A..J hoặc cột 'đáp án đúng').");
      }
      return { id, title, points, question_type: "short_answer", options: accepted };
    }

    case "multiple_choice": {
      const options: QuizQuestionOption[] = optionIndices
        .map((idx, i) => ({ label: String.fromCharCode(65 + i), content: values[idx] || "", is_correct: false }))
        .filter((opt) => opt.content.trim() !== "");
      if (options.length < 2) {
        return fail("multiple_choice cần ít nhất 2 cột phương án có nội dung.");
      }
      // correct = a set of letters, e.g. "A,C" (also accepts the full text of one option).
      const letters = correct.toUpperCase().replace(/\s/g, "").split(",").filter(Boolean);
      let matched = 0;
      for (const letter of letters) {
        const hit = options.find((opt) => opt.label === letter);
        if (hit) {
          hit.is_correct = true;
          matched++;
        }
      }
      if (matched === 0) {
        // Fall back to matching by full text.
        const text = correct.trim();
        const hit = options.find((opt) => opt.content.toLowerCase() === text.toLowerCase());
        if (hit) {
          hit.is_correct = true;
          matched++;
        }
      }
      if (matched === 0) {
        return fail(`multiple_choice cần cột 'đáp án đúng' chứa chữ cái (VD: "A,C").`);
      }
      return { id, title, points, question_type: "multiple_choice", options };
    }

    default: {
      // Legacy single_choice layout.
      const options: QuizQuestionOption[] = optionIndices
        .map((idx, i) => ({ label: String.fromCharCode(65 + i), content: values[idx] || "", is_correct: false }))
        .filter((opt) => opt.content.trim() !== "");
      if (options.length < 2) {
        return fail("single_choice cần ít nhất 2 cột phương án (A, B, C, D) có nội dung.");
      }
      const letter = correct.toUpperCase();
      const hit = options.find((opt) => opt.label === letter);
      if (hit) {
        hit.is_correct = true;
      } else {
        options[0].is_correct = true;
      }
      return { id, title, points, question_type: "single_choice", options };
    }
  }
}

/**
 * Parse Excel file to QuizQuestion array
 * Note: This is a basic implementation. For full Excel support, consider using xlsx library
 */
export async function parseExcelFile(file: File): Promise<QuizQuestion[]> {
  // For now, we'll try to parse as CSV first
  // In production, you might want to use xlsx library: npm install xlsx
  // Or send to backend API to parse
  return parseCSVFile(file);
}

/**
 * Parse file based on extension
 */
export async function parseQuestionsFile(file: File): Promise<QuizQuestion[]> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".csv")) {
    return parseCSVFile(file);
  } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    return parseExcelFile(file);
  } else if (fileName.endsWith(".docx")) {
    // DOCX parsing would require backend API or mammoth library
    throw new Error("File DOCX hiện chưa được hỗ trợ. Vui lòng sử dụng CSV hoặc Excel.");
  } else {
    throw new Error("Định dạng file không được hỗ trợ. Vui lòng sử dụng CSV, Excel (.xlsx, .xls)");
  }
}
