"use client";
import { useAssignments } from "@/hooks/use-api";
import { ArrowPathIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { ListSkeleton } from "@/components/ui/loading";
import { getObjId } from "@/lib/id-utils";

export function AssignmentsList() {
  const { data: assignments, loading, error } = useAssignments();

  if (loading) {
    return (
      <div className="rounded-lg bg-white dark:bg-gray-800">
        <div className="p-6">
          <ListSkeleton count={5} showAvatar={false} />
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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Error Loading Assignments</h3>
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

  if (!assignments || assignments.length === 0) {
    return (
      <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
        <div className="text-center">
          <div className="text-gray-400 mb-4">
            <ExclamationTriangleIcon className="mx-auto h-12 w-12" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Assignments Found</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">Create your first assignment to get started</p>
          <Link
            href="/assignments/create"
            className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90"
          >
            <ArrowPathIcon className="mr-2 h-4 w-4" />
            Create First Assignment
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
            All Assignments ({assignments.length})
          </h2>
          <div className="flex items-center gap-2">
            <select className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
              <option>All Status</option>
              <option>Published</option>
              <option>Draft</option>
            </select>
          </div>
        </div>

        <div className="space-y-3">
          {assignments.map((assignment: any) => (
            <div key={getObjId(assignment)} className="rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{assignment.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {assignment.description || 'No description'}
                  </p>
                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500">
                    <span>Class: {assignment.class?.name || 'Unknown'}</span>
                    <span>Due: {new Date(assignment.due_date).toLocaleDateString()}</span>
                    {assignment.max_points && (
                      <span>Max Points: {assignment.max_points}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${assignment.status === 'published' ? 'bg-success/10 text-success' :
                    assignment.status === 'draft' ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' :
                      'bg-warning/10 text-warning'
                    }`}>
                    {assignment.status}
                  </span>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/assignments/${getObjId(assignment)}`}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90"
                    >
                      View
                    </Link>
                    <Link
                      href={`/assignments/${getObjId(assignment)}/edit`}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
