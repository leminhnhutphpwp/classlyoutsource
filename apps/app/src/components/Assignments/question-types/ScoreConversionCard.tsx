"use client";

import { useMemo, useState } from "react";
import type { CertKey } from "./score-conversion";
import { CEFR_BANDS, CERT_LABELS, convertScore, validateScore } from "./score-conversion";

/**
 * Interactive score-conversion card (P17): pick two certificates, enter a score, see the
 * equivalent band + CEFR label, plus the full reference table. Converts BETWEEN standardized
 * certificates only — never maps the platform's internal point scores.
 */
export default function ScoreConversionCard() {
  const [from, setFrom] = useState<CertKey>("PTE");
  const [to, setTo] = useState<CertKey>("IELTS");
  const [raw, setRaw] = useState("65");
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => {
    const value = parseFloat(raw);
    const invalid = validateScore(value, from);
    setError(invalid);
    if (invalid) return null;
    return convertScore(value, from, to);
  }, [raw, from, to]);

  const certOptions = (Object.keys(CERT_LABELS) as CertKey[]).map((key) => (
    <option key={key} value={key}>{CERT_LABELS[key]}</option>
  ));

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 sm:p-5">
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
        Quy đổi điểm chứng chỉ (tham khảo)
      </h4>
      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
        Quy đổi giữa các chứng chỉ theo thang CEFR — không thay thế kết quả chính thức.
      </p>

      {/* Row 1: inputs */}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Từ chứng chỉ</span>
          <select
            value={from}
            onChange={(e) => setFrom(e.target.value as CertKey)}
            className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            {certOptions}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Điểm của bạn</span>
          <input
            type="number"
            inputMode="decimal"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Sang chứng chỉ</span>
          <select
            value={to}
            onChange={(e) => setTo(e.target.value as CertKey)}
            className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            {certOptions}
          </select>
        </label>
      </div>

      {/* Row 2: result band */}
      {error ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      ) : result ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/5">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {result.display ?? "—"}
          </p>
          <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">
            {result.display
              ? `${CERT_LABELS[from]} ${result.value} ≈ ${CERT_LABELS[to]} ${result.display} · tương đương ${result.cefr}`
              : `${result.cefr ?? "?"} chưa có mốc quy đổi sang ${CERT_LABELS[to]} được công bố.`}
          </p>
        </div>
      ) : null}

      {/* Row 3: full reference table (desktop table; mobile becomes horizontal-scroll). */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-xs">
          <thead>
            <tr className="bg-primary/10 text-left">
              <th className="rounded-l-md px-2.5 py-2 font-semibold text-gray-700 dark:text-gray-200">CEFR</th>
              <th className="px-2.5 py-2 font-semibold text-gray-700 dark:text-gray-200">PTE</th>
              <th className="px-2.5 py-2 font-semibold text-gray-700 dark:text-gray-200">IELTS</th>
              <th className="px-2.5 py-2 font-semibold text-gray-700 dark:text-gray-200">TOEIC</th>
              <th className="rounded-r-md px-2.5 py-2 font-semibold text-gray-700 dark:text-gray-200">DET</th>
            </tr>
          </thead>
          <tbody>
            {CEFR_BANDS.map((band) => (
              <tr key={band.cefr} className="border-b border-gray-100 last:border-0 dark:border-gray-700/60">
                <td className="px-2.5 py-2 font-semibold text-gray-900 dark:text-white">{band.cefr}</td>
                <td className="px-2.5 py-2 text-gray-600 dark:text-gray-300">{band.pte?.display ?? "—"}</td>
                <td className="px-2.5 py-2 text-gray-600 dark:text-gray-300">{band.ielts?.display ?? "—"}</td>
                <td className="px-2.5 py-2 text-gray-600 dark:text-gray-300">{band.toeic?.display ?? "—"}</td>
                <td className="px-2.5 py-2 text-gray-600 dark:text-gray-300">{band.det?.display ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
        Nguồn: bảng quy đổi tham khảo của trung tâm — vui lòng đối chiếu mốc chính thức của Pearson / ETS / Duolingo khi nộp hồ sơ.
      </p>
    </div>
  );
}
