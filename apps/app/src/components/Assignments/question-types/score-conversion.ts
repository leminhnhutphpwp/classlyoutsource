/**
 * Score conversion between standardized certificates (PTE / IELTS / TOEIC / DET), following the
 * CEFR banding table from the Magic English wireframe (P17). Pure functions — no UI, unit-tested.
 *
 * Honest-usage note: these bands convert BETWEEN standardized certificates. They must never be
 * used to fabricate an equivalent for the platform's internal point scores.
 */

export type CertKey = "PTE" | "IELTS" | "TOEIC" | "DET";

export interface ScoreRange {
  /** Inclusive lower bound of the band. */
  min: number;
  /** Inclusive upper bound (Infinity for open-ended like "945+"). */
  max: number;
  /** Human-readable display, e.g. "8.5–9.0" or "945+". */
  display: string;
}

export interface CefrBand {
  cefr: string;
  /** Wireframe band label, e.g. "Proficient user". */
  label: string;
  pte: ScoreRange | null;
  ielts: ScoreRange | null;
  toeic: ScoreRange | null;
  det: ScoreRange | null;
}

function range(min: number, max: number, display: string): ScoreRange {
  return { min, max, display };
}

/** CEFR banding table (P17 section 03). Order matters: first match wins for lookups. */
export const CEFR_BANDS: CefrBand[] = [
  {
    cefr: "C2", label: "Mastery",
    pte: range(85, 90, "85–90"),
    ielts: range(8.5, 9, "8.5–9.0"),
    toeic: null,
    det: range(140, 160, "140–160"),
  },
  {
    cefr: "C1+", label: "Effective operational proficiency (mạnh)",
    pte: range(76, 84, "76–84"),
    ielts: range(7.5, 8, "7.5–8.0"),
    toeic: range(945, Infinity, "945+"),
    det: range(125, 135, "125–135"),
  },
  {
    cefr: "C1", label: "Effective operational proficiency",
    pte: range(65, 75, "65–75"),
    ielts: range(7, 7, "7.0"),
    toeic: range(860, 940, "860–940"),
    det: range(115, 120, "115–120"),
  },
  {
    cefr: "B2+", label: "Vantage (mạnh)",
    pte: range(58, 64, "58–64"),
    ielts: range(6.5, 6.5, "6.5"),
    toeic: range(785, 855, "785–855"),
    det: range(105, 110, "105–110"),
  },
  {
    cefr: "B2", label: "Vantage",
    pte: range(50, 57, "50–57"),
    ielts: range(6, 6, "6.0"),
    toeic: range(700, 780, "700–780"),
    det: range(95, 100, "95–100"),
  },
];

/** Valid score spans per certificate (used for input validation, per P17's error state). */
export const CERT_SCALE: Record<CertKey, { min: number; max: number; step: number }> = {
  PTE: { min: 10, max: 90, step: 1 },
  IELTS: { min: 0, max: 9, step: 0.5 },
  TOEIC: { min: 10, max: 990, step: 5 },
  DET: { min: 10, max: 160, step: 5 },
};

export const CERT_LABELS: Record<CertKey, string> = {
  PTE: "PTE Academic",
  IELTS: "IELTS",
  TOEIC: "TOEIC",
  DET: "Duolingo · DET",
};

function bandRange(band: CefrBand, cert: CertKey): ScoreRange | null {
  return band[cert.toLowerCase() as "pte" | "ielts" | "toeic" | "det"];
}

function inRange(rangeObj: ScoreRange | null, value: number): boolean {
  return rangeObj !== null && value >= rangeObj.min && value <= rangeObj.max;
}

/**
 * Validate a score against its certificate scale. Returns a Vietnamese error message
 * (P17 error state wording) or null when valid.
 */
export function validateScore(value: number, cert: CertKey): string | null {
  const scale = CERT_SCALE[cert];
  if (!Number.isFinite(value)) {
    return `Vui lòng nhập điểm ${cert}.`;
  }
  if (value < scale.min || value > scale.max) {
    return `Điểm ${cert} nằm trong khoảng ${scale.min} - ${scale.max}. Vui lòng nhập lại.`;
  }
  const step = scale.step;
  if (step > 0 && Math.abs(value / step - Math.round(value / step)) > 1e-9) {
    return `Điểm ${cert} chỉ nhận bước ${step === 0.5 ? "0.5" : step}. Vui lòng nhập lại.`;
  }
  return null;
}

export interface ConversionResult {
  from: CertKey;
  value: number;
  to: CertKey;
  /** Display string of the converted band, e.g. "7.0" — null when no published band covers it. */
  display: string | null;
  cefr: string | null;
  bandLabel: string | null;
}

/**
 * Convert a score between certificates via the CEFR banding table. Certificates without a band
 * (e.g. TOEIC at C2) return display: null — the UI shows "—" instead of inventing a number.
 */
export function convertScore(value: number, from: CertKey, to: CertKey): ConversionResult {
  const band = CEFR_BANDS.find((b) => inRange(bandRange(b, from), value)) ?? null;

  return {
    from,
    value,
    to,
    display: band ? (bandRange(band, to)?.display ?? null) : null,
    cefr: band?.cefr ?? null,
    bandLabel: band?.label ?? null,
  };
}

/** CEFR band for a certificate score (used to label a converted result). */
export function cefrForScore(value: number, cert: CertKey): CefrBand | null {
  return CEFR_BANDS.find((b) => inRange(bandRange(b, cert), value)) ?? null;
}
