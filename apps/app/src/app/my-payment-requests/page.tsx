"use client";
import { useMemo } from "react";
import ProtectedRoute from "@/components/Auth/ProtectedRoute";
import { useRoleGuard } from "@/hooks/use-role-guard";
import { useStudentId } from "@/hooks/use-student-id";
import { usePaymentsByStudent, useStudentClasses } from "@/hooks/use-api";
import { AcademicCapIcon } from "@heroicons/react/24/outline";
import StudentPaymentRequestsList from "@/components/PaymentRequests/StudentPaymentRequestsList";
import { getObjId } from "@/lib/id-utils";

export default function MyPaymentRequestsPage() {
  const { isBlocked } = useRoleGuard({
    allowedRoles: ["student"],
    redirectTo: "/403",
  });

  const { studentId, loading: studentIdLoading } = useStudentId();

  // Lấy danh sách lớp và payments của học viên để tính trạng thái từng đợt
  const { classes: studentClasses, loading: classesLoading } = useStudentClasses(
    studentId || "0"
  );
  const {
    data: paymentsData,
    loading: paymentsLoading,
  } = usePaymentsByStudent(studentId || "0", {
    per_page: 200,
    page: 1,
  });

  const allPayments = useMemo(() => {
    if (!paymentsData) return [];
    if (paymentsData?.payments && Array.isArray(paymentsData.payments))
      return paymentsData.payments;
    if (paymentsData?.data?.payments && Array.isArray(paymentsData.data.payments))
      return paymentsData.data.payments;
    if (Array.isArray(paymentsData?.data)) return paymentsData.data;
    if (paymentsData?.data?.data && Array.isArray(paymentsData.data.data))
      return paymentsData.data.data;
    return [];
  }, [paymentsData]);

  const classIds = useMemo(() => {
    if (!studentClasses || !Array.isArray(studentClasses) || studentClasses.length === 0) {
      return [];
    }
    return studentClasses
      .map((cls: any) => getObjId(cls))
      .filter(Boolean);
  }, [studentClasses]);

  if (isBlocked) {
    return null;
  }

  if (studentIdLoading || classesLoading || paymentsLoading) {
    return (
      <ProtectedRoute>
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="h-8 w-60 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="h-4 w-72 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
          </div>

          <div className="rounded-lg bg-white p-4 dark:bg-gray-800">
            <div className="space-y-3">
              <div className="h-4 w-40 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-6 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 dark:bg-gray-800">
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={`request-skeleton-${i}`}
                  className="h-24 rounded-lg bg-gray-100 dark:bg-gray-700/40 animate-pulse"
                />
              ))}
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!studentId) {
    return (
      <ProtectedRoute>
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-6 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400">
          <p className="font-semibold">Không tìm thấy thông tin học viên</p>
          <p className="mt-2 text-sm">
            Vui lòng đảm bảo bạn đã đăng nhập với tài khoản học viên hợp lệ.
          </p>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Các đợt đóng học phí
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Danh sách các đợt đóng học phí do giáo viên tạo cho các lớp học của bạn
          </p>
        </div>

        {/* Các đợt đóng học phí */}
        <div className="space-y-4">
          {classIds.length === 0 ? (
            <div className="rounded-lg bg-white p-4 dark:bg-gray-800">
              <div className="text-center py-8">
                <AcademicCapIcon className="mx-auto h-10 w-10 text-gray-400" />
                <h3 className="mt-3 text-sm font-medium text-gray-900 dark:text-white">
                  Chưa có lớp học
                </h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Bạn chưa tham gia lớp học nào.
                </p>
              </div>
            </div>
          ) : (
            <StudentPaymentRequestsList
              classIds={classIds}
              selectedClassId="all"
              studentClasses={studentClasses}
              studentPayments={allPayments}
            />
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}


