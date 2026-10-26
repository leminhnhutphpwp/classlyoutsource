"use client";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ClipboardDocumentCheckIcon } from "@heroicons/react/24/outline";
import { useChildResource } from "@/hooks/use-api/family";
import ResourceView, { formatDate, pick, type Column } from "../_components/ResourceView";

const STATUS_META: Record<string, { label: string; className: string }> = {
  present: { label: "Có mặt", className: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-200" },
  absent: { label: "Vắng mặt", className: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200" },
  late: { label: "Đi muộn", className: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-200" },
  excused: { label: "Có phép", className: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200" },
};

export default function ChildAttendancePage() {
  const params = useParams();
  const studentId = params?.studentId as string;
  const [page, setPage] = useState(1);

  const query = useMemo(() => ({ page, per_page: 15 }), [page]);
  const { data, meta, loading, error, refetch } = useChildResource(studentId, "attendance", query);

  const columns: Column<Record<string, any>>[] = [
    {
      header: "Ngày",
      render: (row) => (
        <span className="font-medium text-gray-900 dark:text-white">
          {formatDate(pick(row, "date", "attendance_date", "session_date"))}
        </span>
      ),
    },
    {
      header: "Lớp học",
      render: (row) => pick(row, "class_name", "class.name") || "—",
    },
    {
      header: "Trạng thái",
      render: (row) => {
        const raw = String(pick(row, "status", "attendance_status") || "").toLowerCase();
        const meta = STATUS_META[raw];
        const label = pick(row, "status_label") || meta?.label || raw || "—";
        const className = meta?.className || "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200";
        return (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
            {label}
          </span>
        );
      },
    },
    {
      header: "Ghi chú",
      render: (row) => pick(row, "note", "remark") || "—",
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
      emptyIcon={<ClipboardDocumentCheckIcon />}
      emptyTitle="Chưa có dữ liệu điểm danh"
      emptyHint="Kết quả điểm danh của học viên sẽ hiển thị tại đây."
      itemLabel="lượt điểm danh"
    />
  );
}
