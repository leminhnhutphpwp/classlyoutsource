"use client";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AcademicCapIcon } from "@heroicons/react/24/outline";
import { useChildResource } from "@/hooks/use-api/family";
import { formatScore } from "@/lib/format-score";
import ResourceView, { formatDate, pick, type Column } from "../_components/ResourceView";

export default function ChildGradesPage() {
  const params = useParams();
  const studentId = params?.studentId as string;
  const [page, setPage] = useState(1);

  const query = useMemo(() => ({ page, per_page: 15 }), [page]);
  const { data, meta, loading, error, refetch } = useChildResource(studentId, "grades", query);

  const columns: Column<Record<string, any>>[] = [
    {
      header: "Ngày",
      render: (row) => (
        <span className="font-medium text-gray-900 dark:text-white">
          {formatDate(pick(row, "date", "graded_at", "created_at"))}
        </span>
      ),
    },
    {
      header: "Lớp học",
      render: (row) => pick(row, "class_name", "class.name") || "—",
    },
    {
      header: "Loại điểm",
      render: (row) => pick(row, "grade_type", "grade_type_name", "type", "title") || "—",
    },
    {
      header: "Điểm",
      className: "font-semibold text-gray-900 dark:text-white",
      render: (row) => {
        const score = pick(row, "score", "value", "grade");
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
      emptyIcon={<AcademicCapIcon />}
      emptyTitle="Chưa có điểm số"
      emptyHint="Kết quả điểm số của học viên sẽ hiển thị tại đây."
      itemLabel="đầu điểm"
    />
  );
}
