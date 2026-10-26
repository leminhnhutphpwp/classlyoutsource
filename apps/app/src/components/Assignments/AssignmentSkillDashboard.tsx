"use client";

import { useMemo } from "react";
import Link from "next/link";
import { UserIcon } from "@heroicons/react/24/outline";
import type { SkillReportPayload, SkillReportStudent } from "@/lib/api-config";

const SKILL_LABELS: Record<string, string> = {
  listening: "Listening",
  reading: "Reading",
  writing: "Writing",
  speaking: "Speaking",
  general: "Tổng hợp",
};

function skillLabel(type: string): string {
  return SKILL_LABELS[type] ?? type;
}

function heatClass(percent: number): string {
  if (percent >= 80) return "bg-green-500/80 text-white";
  if (percent >= 60) return "bg-green-400/70 text-white";
  if (percent >= 40) return "bg-amber-400/80 text-gray-900";
  if (percent > 0) return "bg-red-400/80 text-white";
  return "bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500";
}

/**
 * Tutor progress dashboard for a quiz assignment: one row per student, one heatmap cell per
 * exam skill (section_type bucket) + the overall bar. Data comes from the aggregated
 * /skill-report endpoint (single request, latest attempt per student).
 */
export default function AssignmentSkillDashboard({ report }: { report: SkillReportPayload }) {
  const students = report.students;
  // Column set = union of skills seen across students, in a stable exam order.
  const skillColumns = useMemo(() => {
    const order = ["listening", "reading", "writing", "speaking", "general"];
    const seen = new Set<string>();
    students.forEach((student: SkillReportStudent) =>
      student.skills.forEach((s) => seen.add(s.type))
    );
    return [...seen].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }, [students]);

  if (students.length === 0) {
    return (
      <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tiến độ theo kỹ năng</h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Chưa có bài làm nào để tổng hợp. Dashboard sẽ tự đầy khi học viên nộp bài.
        </p>
      </div>
    );
  }

  const classAverage =
    students.reduce((sum, s) => sum + s.percent, 0) / Math.max(1, students.length);

  return (
    <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Tiến độ theo kỹ năng ({students.length} học viên)
        </h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Trung bình lớp: <strong className="text-gray-900 dark:text-white">{Math.round(classAverage)}%</strong>
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <th className="px-3 py-2 font-medium">Học viên</th>
              {skillColumns.map((type) => (
                <th key={type} className="px-2 py-2 text-center font-medium">{skillLabel(type)}</th>
              ))}
              <th className="px-3 py-2 text-right font-medium">Tổng</th>
              <th className="px-2 py-2 text-center font-medium">Lần làm</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr
                key={student.student_id}
                className="border-t border-gray-100 dark:border-gray-700/60"
              >
                <td className="px-3 py-2.5">
                  <Link
                    href={`/students/${student.student_id}`}
                    className="flex items-center gap-2 font-medium text-gray-900 hover:underline dark:text-white"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                      <UserIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    </span>
                    {student.student_name}
                  </Link>
                </td>
                {skillColumns.map((type) => {
                  const skill = student.skills.find((s) => s.type === type);
                  const percent = skill?.percent ?? 0;
                  const has = !!skill && skill.possible > 0;
                  return (
                    <td key={type} className="px-2 py-2.5 text-center">
                      <span
                        title={has ? `${skillLabel(type)}: ${skill!.earned}/${skill!.possible} điểm` : "Chưa có điểm"}
                        className={`inline-flex h-9 w-11 items-center justify-center rounded-lg text-xs font-bold ${has ? heatClass(percent) : heatClass(0)}`}
                      >
                        {has ? `${percent}%` : "—"}
                      </span>
                    </td>
                  );
                })}
                <td className="px-3 py-2.5 text-right">
                  <div className="flex flex-col items-end">
                    <span className="font-bold text-gray-900 dark:text-white">{student.percent}%</span>
                    <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                      <div
                        className="h-1.5 rounded-full bg-primary"
                        style={{ width: `${Math.min(100, student.percent)}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-2 py-2.5 text-center text-xs text-gray-500 dark:text-gray-400">
                  {student.attempt_count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
        Ô màu: xanh ≥80% · xanh nhạt ≥60% · vàng ≥40% · đỏ &lt;40% · dấu gạch ngang là chưa có điểm. Số liệu lấy từ lần làm mới nhất của mỗi học viên.
      </p>
    </div>
  );
}
