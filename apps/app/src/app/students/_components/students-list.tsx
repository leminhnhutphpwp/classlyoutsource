"use client";
import { useStudents } from "@/hooks/use-api";
import { ArrowPathIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { ListSkeleton } from "@/components/ui/loading";
import { getObjId } from "@/lib/id-utils";

export function StudentsList() {
  const { data: students, loading, error } = useStudents();

  if (loading) {
    return (
      <div className="rounded-lg bg-white dark:bg-gray-800">
        <div className="p-6">
          <ListSkeleton count={5} showAvatar={true} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
        <div className="text-center">
          <div className="text-red-600 dark:text-red-400 mb-4">
            <ExclamationTriangleIcon className="mx-auto h-12 w-12" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Lỗi tải học viên</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  if (!students || students.length === 0) {
    return (
      <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
        <div className="text-center">
          <div className="text-gray-400 mb-4">
            <ExclamationTriangleIcon className="mx-auto h-12 w-12" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Chưa có học viên</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">Thêm học viên đầu tiên để bắt đầu</p>
          <Link
            href="/students/create"
            className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90"
          >
            <ArrowPathIcon className="mr-2 h-4 w-4" />
            Thêm học viên
          </Link>

          <Link
            href="/students/create"
            className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90"
          >
            <ArrowPathIcon className="mr-2 h-4 w-4" />
            Thêm học viên
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white dark:bg-gray-800">
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Tất cả học viên ({students.length})
          </h2>
          <div className="flex items-center gap-2">
            <select className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
              <option>Tất cả trạng thái</option>
              <option>Đang học</option>
              <option>Đã nghỉ</option>
            </select>
          </div>
        </div>

        <div className="space-y-3">
          {students.map((student: any) => {
            const studentId = getObjId(student);
            return (
              <div key={studentId} className="rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/10">
                      <span className="text-lg font-medium text-secondary">
                        {student.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{student.name}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {student.email || 'Không có email'}
                      </p>
                      {student.phone && (
                        <p className="text-sm text-gray-500 dark:text-gray-500">
                          {student.phone}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {student.classes_count || 0} lớp
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        {student.assignments_count || 0} bài tập
                      </p>
                    </div>

                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${student.status === 'active'
                      ? 'bg-success/10 text-success'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}>
                      {student.status === 'active' ? 'Đang học' : 'Đã nghỉ'}
                    </span>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/students/${studentId}`}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90"
                      >
                        Xem
                      </Link>
                      <Link
                        href={`/students/${studentId}/edit`}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        Sửa
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
