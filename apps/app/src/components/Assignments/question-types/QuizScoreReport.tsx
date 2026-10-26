"use client";

import { useMemo } from "react";
import {
  ArrowTrendingUpIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import type { QuizReviewPayload } from "@/lib/api-config";
import {
  computeInsights,
  computeScoreSummary,
  computeSkillScores,
  type InsightLine,
} from "./score-report";

function SkillCard({
  label,
  earned,
  possible,
  percent,
  passed,
}: {
  label: string;
  earned: number;
  possible: number;
  percent: number;
  passed: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{label}</p>
        <b className="text-xl font-bold text-gray-900 dark:text-white">{percent}%</b>
      </div>
      {/* Plain track + fill: the label "Đạt / Chưa đạt" carries the meaning, not color alone. */}
      <div className="my-2 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700">
        <div
          className={`h-1.5 rounded-full ${passed ? "bg-green-500" : "bg-amber-500"}`}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
      <p className={`text-xs ${passed ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
        {possible > 0 ? `${passed ? "Đạt" : "Chưa đạt"} · ${earned}/${possible} điểm` : "Chưa có điểm"}
      </p>
    </div>
  );
}

function InsightCard({
  title,
  icon,
  lines,
  tone,
  emptyText,
}: {
  title: string;
  icon: React.ReactNode;
  lines: InsightLine[];
  tone: "green" | "amber";
  emptyText: string;
}) {
  const toneClass =
    tone === "green"
      ? "border-green-200 bg-green-50/70 dark:border-green-500/30 dark:bg-green-500/5"
      : "border-amber-200 bg-amber-50/70 dark:border-amber-500/30 dark:bg-amber-500/5";

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h4>
      </div>
      {lines.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">{emptyText}</p>
      ) : (
        <ul className="space-y-1.5">
          {lines.map((line) => (
            <li key={line.title} className="flex items-start justify-between gap-3 text-sm">
              <span className="font-medium text-gray-900 dark:text-white">{line.title}</span>
              <span className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">{line.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Score report hero following the "Kết quả thi thử" wireframe (P5): dark total-score card with
 * a progress ring, per-skill bars bucketed by section_type, and strengths/improvements lists.
 * Pure math lives in score-report.ts (unit-tested); this component only renders.
 */
export default function QuizScoreReport({ review }: { review: QuizReviewPayload }) {
  const summary = useMemo(() => computeScoreSummary(review), [review]);
  const skills = useMemo(() => computeSkillScores(review), [review]);
  const { strengths, improvements } = useMemo(() => computeInsights(review), [review]);

  const circumference = 2 * Math.PI * 42;
  const dashOffset = circumference * (1 - Math.min(100, summary.percent) / 100);

  return (
    <div className="space-y-4">
      {/* 01 · Total score card (dark) + progress ring */}
      <div className="rounded-2xl bg-gray-900 p-5 text-white dark:bg-gray-800 sm:p-6">
        <div className="flex flex-wrap items-center gap-6">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wide text-gray-400">Điểm tổng</p>
            <p className="mt-1 font-bold leading-none">
              <span className="text-5xl sm:text-6xl">{summary.graded ? summary.earned : "—"}</span>
              <span className="ml-1 text-xl text-gray-400">/ {summary.possible}</span>
            </p>
            <p className="mt-2 text-sm text-gray-300">
              {summary.graded
                ? `Xếp loại: ${summary.grade} — đạt ${summary.percent}% số điểm`
                : "Bài làm đang chờ chấm điểm"}
            </p>
          </div>
          {/* Progress ring: percent label also written as text (not color-only). */}
          <div className="relative h-24 w-24 flex-shrink-0" role="img" aria-label={`Đạt ${summary.percent}%`}>
            <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="8" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke={summary.percent >= 60 ? "#4ade80" : "#fbbf24"}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
              {summary.percent}%
            </span>
          </div>
        </div>
      </div>

      {/* 02 · Per-skill cards */}
      {skills.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {skills.map((skill) => (
            <SkillCard key={skill.type} {...skill} />
          ))}
        </div>
      )}

      {/* 03 · Strengths / improvements */}
      {(strengths.length > 0 || improvements.length > 0) && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <InsightCard
            title="Bạn đang làm tốt"
            icon={<ArrowTrendingUpIcon className="h-5 w-5 text-green-600" />}
            lines={strengths}
            tone="green"
            emptyText="Chưa có phần thi nào đạt mức 70% — tiếp tục luyện thêm nhé."
          />
          <InsightCard
            title="Cần ưu tiên cải thiện"
            icon={<ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />}
            lines={improvements}
            tone="amber"
            emptyText="Không có phần thi nào dưới 70% — giữ phong độ nhé!"
          />
        </div>
      )}

      {/* Ghi chú nguồn số liệu — percent là của phần tự chấm, câu chấm tay chưa tính đủ */}
      {skills.some((s) => s.possible === 0) && (
        <p className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
          <ChartBarIcon className="h-4 w-4" />
          Phần thi chưa có điểm (chờ chấm tay) chưa được tính vào các tỷ lệ trên.
        </p>
      )}
    </div>
  );
}
