"use client";
import { useClass } from "@/hooks/use-api";
import Link from "next/link";
import Button from "@/components/Common/Button";
import { ArrowLeftIcon, CalendarIcon, DocumentTextIcon, ExclamationTriangleIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { useGoBack } from "@/hooks/use-go-back";
interface ClassDetailsProps {
  classId: string;
}

export function ClassDetails({ classId }: ClassDetailsProps) {
  const { data: classData, loading, error } = useClass(classId);
  const handleGoBack = useGoBack('/classes');

  if (loading) {
    return (
      <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
        <div className="animate-pulse">
          <div className="h-8 w-64 rounded bg-gray-200 dark:bg-gray-700 mb-4" />
          <div className="h-4 w-96 rounded bg-gray-200 dark:bg-gray-700 mb-6" />
          <div className="flex gap-4">
            <div className="h-10 w-24 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-10 w-24 rounded bg-gray-200 dark:bg-gray-700" />
          </div>
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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Lỗi tải dữ liệu lớp học</h3>
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Không tìm thấy lớp học</h3>
          <p className="text-gray-600 dark:text-gray-400">Lớp học bạn đang tìm kiếm không tồn tại.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-4">
            <Button
              onClick={handleGoBack}
              variant="outline"
              size="sm"
              icon={<ArrowLeftIcon />}
            >
              Quay lại
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{classData.name}</h1>
              <p className="text-gray-600 dark:text-gray-400">
                {classData.description || 'Chưa có mô tả'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-700">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <UserGroupIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Học viên</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {classData.students_count || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-700">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/10">
                  <DocumentTextIcon className="h-5 w-5 text-secondary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Bài tập</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {classData.assignments_count || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-700">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-pastel/40">
                  <CalendarIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Trạng thái</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {classData.status === 'active' ? 'Đang dạy' : 'Tạm dừng'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/classes/${classId}/edit`}
            className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Chỉnh sửa
          </Link>
          <button className="rounded-lg bg-primary px-4 py-2 font-medium text-white transition-colors hover:bg-primary/90">
            Điểm danh
          </button>
        </div>
      </div>
    </div>
  );
}
