"use client";
import { useAttendance } from "@/hooks/use-api";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { ListSkeleton } from "@/components/ui/loading";
import { getObjId } from "@/lib/id-utils";

export function AttendanceList() {
  const { data: attendance, loading, error } = useAttendance();

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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Error Loading Attendance</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!attendance || attendance.length === 0) {
    return (
      <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
        <div className="text-center">
          <div className="text-gray-400 mb-4">
            <ExclamationTriangleIcon className="mx-auto h-12 w-12" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Attendance Records</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">Start taking attendance to see records here</p>
          <button className="rounded-lg bg-success px-4 py-2 font-medium text-white hover:bg-success/90">
            Take Attendance
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white dark:bg-gray-800">
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Recent Attendance ({attendance.length})
          </h2>
          <div className="flex items-center gap-2">
            <select className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
              <option>All Status</option>
              <option>Present</option>
              <option>Absent</option>
              <option>Late</option>
            </select>
          </div>
        </div>

        <div className="space-y-3">
          {attendance.map((record: any) => (
            <div key={getObjId(record)} className="rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${record.status === 'present' ? 'bg-success/10' :
                    record.status === 'absent' ? 'bg-red-100 dark:bg-red-900/20' :
                      record.status === 'late' ? 'bg-warning/10' :
                        'bg-gray-100 dark:bg-gray-700'
                    }`}>
                    <span className={`text-sm font-medium ${record.status === 'present' ? 'text-success' :
                      record.status === 'absent' ? 'text-red-600 dark:text-red-400' :
                        record.status === 'late' ? 'text-warning' :
                          'text-gray-600 dark:text-gray-400'
                      }`}>
                      {record.status === 'present' ? '✓' :
                        record.status === 'absent' ? '✗' :
                          record.status === 'late' ? '⏰' : '?'}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {record.student?.name || 'Unknown Student'}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {record.class?.name || 'Unknown Class'} • {new Date(record.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${record.status === 'present' ? 'bg-success/10 text-success' :
                    record.status === 'absent' ? 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400' :
                      record.status === 'late' ? 'bg-warning/10 text-warning' :
                        'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                    {record.status}
                  </span>

                  <Link
                    href={`/attendance/${getObjId(record)}`}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
