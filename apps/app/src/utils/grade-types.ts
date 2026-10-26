export type GradeTypeLike = {
  display_name?: string;
  name?: string;
  code?: string;
};

export const formatGradeTypeLabel = (gradeType: GradeTypeLike) => {
  const base = gradeType.display_name || gradeType.name || "";
  const code = (gradeType.code || "").trim();
  if (code && !base.toUpperCase().includes(code.toUpperCase())) {
    return `${base} (${code})`;
  }
  return base || code;
};

