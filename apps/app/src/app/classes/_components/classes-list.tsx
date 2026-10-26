"use client";
import { useClasses } from "@/hooks/use-api";
import Link from "next/link";
import { ClassCard } from "@/components/Classes/ClassCard";
import ButtonLink from "@/components/Common/ButtonLink";
import { ArrowPathIcon, ExclamationTriangleIcon, EyeIcon, PencilIcon } from "@heroicons/react/24/outline";
import { ListSkeleton } from "@/components/ui/loading";
import { getObjId } from "@/lib/id-utils";

export function ClassesList() {
  const { data: classes, loading, error } = useClasses();

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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Error Loading Classes</h3>
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

  if (!classes || classes.length === 0) {
    return (
      <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
        <div className="text-center">
          <div className="text-gray-400 mb-4">
            <ExclamationTriangleIcon className="mx-auto h-12 w-12" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Chưa có lớp học</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">Tạo lớp học đầu tiên để bắt đầu</p>
          <Link
            href="/classes/create"
            className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90"
          >
            <ArrowPathIcon className="mr-2 h-4 w-4" />
            Tạo lớp học đầu tiên
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
            All Classes ({classes.length})
          </h2>
          <div className="flex items-center gap-2">
            <select className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
              <option>All Status</option>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </div>
        </div>

        <div className="space-y-3">
          {classes.map((classItem: any) => (
            <div
              key={getObjId(classItem)}
              className="rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50"
            >
              <ClassCard
                cls={classItem}
                showEnrollment={false}
                showTuition={false}
                actions={
                  <>
                    <ButtonLink
                      href={`/classes/${getObjId(classItem)}`}
                      variant="primary"
                      size="sm"
                      icon={<EyeIcon />}
                    >
                      View
                    </ButtonLink>
                    <ButtonLink
                      href={`/classes/${getObjId(classItem)}/edit`}
                      variant="outline"
                      size="sm"
                      icon={<PencilIcon />}
                    >
                      Edit
                    </ButtonLink>
                  </>
                }
                className="border-0 shadow-none p-0"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
