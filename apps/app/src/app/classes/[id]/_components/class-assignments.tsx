"use client";
import { useAssignmentsByClass } from "@/hooks/use-api";
import Link from "next/link";
import { useAuthContext } from "@/contexts/auth-context";
import { isStudent } from "@/lib/authz";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { ListSkeleton } from "@/components/ui/loading";
import { getObjId } from "@/lib/id-utils";
interface ClassAssignmentsProps {
  classId: string;
}

export function ClassAssignments({ classId }: ClassAssignmentsProps) {
  const { user } = useAuthContext();
  const isStudentUser = isStudent(user);
  const { data: assignments, loading, error } = useAssignmentsByClass(classId);

  if (loading) {
    return <ListSkeleton count={3} showAvatar={false} />;
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 dark:text-red-400 mb-4">
          <ExclamationTriangleIcon className="mx-auto h-12 w-12" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Lỗi tải bài tập</h3>
        <p className="text-gray-600 dark:text-gray-400">{error}</p>
      </div>
    );
  }

  if (!assignments || assignments.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-400 mb-4">
          <ExclamationTriangleIcon className="mx-auto h-12 w-12" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Chưa có bài tập</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">Tạo bài tập cho lớp học này</p>
        <button className="rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary/90">
          Tạo bài tập
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Bài tập ({assignments.length})
        </h3>
        <button className="rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary/90">
          Tạo bài tập
        </button>
      </div>

      <div className="space-y-3">
        {assignments.map((assignment: any) => (
          <div key={getObjId(assignment)} className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 dark:text-white">{assignment.title}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {assignment.description || 'Không có mô tả'}
                </p>
                <div className="mt-2 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500">
                  <span>Hạn nộp: {new Date(assignment.due_date).toLocaleDateString('vi-VN')}</span>
                  {assignment.max_points && (
                    <span>Điểm tối đa: {assignment.max_points}</span>
                  )}
                  {assignment.submissions_count !== undefined && (
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      Đã nộp: {assignment.submissions_count || 0}
                      {assignment.graded_submissions_count !== undefined && assignment.graded_submissions_count > 0 && (
                        <span className="text-primary ml-1">
                          ({assignment.graded_submissions_count} đã chấm)
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${assignment.status === 'published'
                  ? 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]'
                  : assignment.status === 'draft'
                    ? 'bg-[var(--status-badge-pending)] text-[var(--status-badge-pending-text)]'
                    : 'bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]'
                  }`}>
                  {assignment.status === 'published' ? (isStudentUser ? 'Đang làm' : 'Đang giao') : assignment.status === 'draft' ? 'Sắp giao' : assignment.status}
                </span>

                <Link
                  href={`/assignments/${getObjId(assignment)}`}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Xem
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
