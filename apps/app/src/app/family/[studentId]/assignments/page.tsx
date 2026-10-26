"use client";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { DocumentTextIcon } from "@heroicons/react/24/outline";
import { useChildResource } from "@/hooks/use-api/family";
import { formatScore } from "@/lib/format-score";
import ResourceView, { formatDate, pick, type Column } from "../_components/ResourceView";

export default function ChildAssignmentsPage() {
  const params = useParams();
  const studentId = params?.studentId as string;
  const [page, setPage] = useState(1);

  const query = useMemo(() => ({ page, per_page: 15 }), [page]);
  const { data, meta, loading, error, refetch } = useChildResource(studentId, "assignments", query);

  const columns: Column<Record<string, any>>[] = [
    {
      header: "Bài tập",
      render: (row) => (
        <span className="font-medium text-gray-900 dark:text-white">
          {pick(row, "title", "name") || "—"}
        </span>
      ),
    },
    {
      header: "Lớp học",
      render: (row) => pick(row, "class_name", "class.name") || "—",
    },
    {
      header: "Hạn nộp",
      render: (row) => formatDate(pick(row, "due_date", "deadline")),
    },
    {
      header: "Trạng thái",
      render: (row) => {
        const submission = pick(row, "my_submission", "submission");
        const submitted = pick(row, "submitted") ?? !!submission;
        return submitted ? (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-500/20 dark:text-green-200">
            Đã nộp
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-500/20 dark:text-orange-200">
            Chưa nộp
          </span>
        );
      },
    },
    {
      header: "Điểm",
      className: "font-semibold text-gray-900 dark:text-white",
      render: (row) => {
        const score = pick(row, "score", "my_submission.score", "submission.score");
        const max = pick(row, "max_score", "max");
        if (score === undefined) return "—";
        return formatScore(Number(score), max !== undefined ? Number(max) : undefined);
      },
    },
  ];

  return (
    <ResourceView
      data={data}
      columns={columns}
      loading={loading}
      error={error}
      meta={meta}
      currentPage={page}
      onPageChange={setPage}
      onRetry={refetch}
      rowKey={(row, i) => String(pick(row, "id") ?? i)}
      emptyIcon={<DocumentTextIcon />}
      emptyTitle="Chưa có bài tập"
      emptyHint="Bài tập của học viên sẽ hiển thị tại đây khi giáo viên giao bài."
      itemLabel="bài tập"
    />
  );
}
