"use client";
import { useClassStudents } from "@/hooks/use-api";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { ListSkeleton } from "@/components/ui/loading";
import { getObjId } from "@/lib/id-utils";

interface ClassStudentsProps {
  classId: string;
}

export function ClassStudents({ classId }: ClassStudentsProps) {
  const { data: students, loading, error } = useClassStudents(classId);

  if (loading) {
    return <ListSkeleton count={3} showAvatar={true} />;
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 dark:text-red-400 mb-4">
          <ExclamationTriangleIcon className="mx-auto h-12 w-12" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Error Loading Students</h3>
        <p className="text-gray-600 dark:text-gray-400">{error}</p>
      </div>
    );
  }

  if (!students || students.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-400 mb-4">
          <ExclamationTriangleIcon className="mx-auto h-12 w-12" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Students Enrolled</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">Add students to this class to get started</p>
        <button className="rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary/90">
          Add Students
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Students ({students.length})
        </h3>
        <button className="rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary/90">
          Add Student
        </button>
      </div>

      <div className="space-y-3">
        {students.map((student: any) => (
          <div key={getObjId(student)} className="flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-700">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/10">
                <span className="text-sm font-medium text-secondary">
                  {student.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">{student.name}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {student.email || 'No email'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {student.enrollment?.is_paused ? (
                <span className="rounded-full px-3 py-1 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                  Tạm dừng
                </span>
              ) : (
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${student.status === 'active'
                  ? 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]'
                  : 'bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]'
                  }`}>
                  {student.status}
                </span>
              )}

              <Link
                href={`/students/${getObjId(student)}`}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                View Profile
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
