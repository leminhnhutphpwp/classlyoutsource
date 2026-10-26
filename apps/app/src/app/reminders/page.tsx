"use client";
import { useMemo, useState, useEffect } from "react";
import {
  BellIcon,
} from "@heroicons/react/24/outline";
import ProtectedRoute from "@/components/Auth/ProtectedRoute";
import SelectInput from "@/components/FormElements/SelectInput";
import Pagination from "@/components/Common/Pagination";
import { useReminders, useClasses } from "@/hooks/use-api";
import { useRoleGuard } from "@/hooks/use-role-guard";
import { useLockContext } from "@/contexts/lock-context";
import { useAuthContext } from "@/contexts/auth-context";
import { isStudent } from "@/lib/authz";
import { hasCapability } from "@/lib/permissions-utils";
import ReminderCard from "@/components/Reminders/ReminderCard";
import { getObjId } from "@/lib/id-utils";
import { useErrorDisplay } from "@/components/Common/ErrorDisplay";
export default function RemindersPage() {
  const { isBlocked } = useRoleGuard({ allowedRoles: ["student", "tutor"] });
  const { actionsLocked, planFeatureMessage, clearPlanFeatureMessage } = useLockContext();
  const { user } = useAuthContext();
  const isStudentUser = isStudent(user);
  const { renderError } = useErrorDisplay("Nhắc nhở");

  // Check if user has reminders capability
  const hasRemindersCapability = hasCapability(user, 'reminders.use');

  const [reminderType, setReminderType] = useState<"all" | "schedule" | "payment" | "assignment">("all");
  const [reminderDaysAhead, setReminderDaysAhead] = useState<number>(7);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const perPage = 10;

  // Only fetch if user has capability and not locked
  const shouldFetch = hasRemindersCapability && !actionsLocked && !planFeatureMessage;

  // Fetch classes list for filter
  const { data: classes } = useClasses(
    { per_page: 100, status: "active" },
    shouldFetch
  );

  const classesList = useMemo(() => {
    if (!classes || !Array.isArray(classes)) return [];

    return classes
      .filter((cls: any) => cls && getObjId(cls) && cls.name)
      .map((cls: any) => {
        const clsId = getObjId(cls);
        return {
          value: String(clsId),
          label: cls.name,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [classes]);

  const { data, loading, error } = useReminders(
    {
      type: reminderType,
      limit: perPage,
      page: currentPage,
      days_ahead: reminderDaysAhead,
      class_id: selectedClassId ? selectedClassId : undefined,
    },
    shouldFetch
  );

  // Với học viên: nếu thiếu quyền (FEATURE_NOT_AVAILABLE), bỏ lock toàn bộ page.
  useEffect(() => {
    if (isStudentUser && error && error.includes('FEATURE_NOT_AVAILABLE')) {
      clearPlanFeatureMessage();
    }
  }, [isStudentUser, error, clearPlanFeatureMessage]);

  const remindersList = useMemo(() => {
    // Use items array (already sorted by backend)
    if (data?.items && Array.isArray(data.items)) {
      return data.items;
    }
    return [];
  }, [data]);

  const paginationMeta = useMemo(() => {
    const meta = (data as any)?.meta || {};
    const per_page = meta?.schedule?.per_page || meta?.payment?.per_page || meta?.assignment?.per_page || perPage;
    const total = (meta?.schedule?.total || 0) + (meta?.payment?.total || 0) + (meta?.assignment?.total || 0);
    const last_page = meta?.schedule?.last_page || meta?.payment?.last_page || meta?.assignment?.last_page || Math.max(1, Math.ceil(total / per_page));
    const page = meta?.schedule?.page || meta?.payment?.page || meta?.assignment?.page || currentPage;
    return { current_page: page, per_page, total, last_page };
  }, [data, currentPage, perPage]);


  if (isBlocked) return null;

  // Với học viên: nếu thiếu quyền (FEATURE_NOT_AVAILABLE), hiển thị thông báo thay vì lock page.
  if (isStudentUser && error && error.includes('FEATURE_NOT_AVAILABLE')) {
    return (
      <ProtectedRoute>
        <div className="min-h-[calc(100vh-120px)] bg-gradient-to-b from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 px-4 py-6 sm:px-6 sm:py-8">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
            <div className="rounded-2xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 p-6 text-center">
              <BellIcon className="mx-auto h-12 w-12 text-orange-500 dark:text-orange-400 mb-4" />
              <h2 className="text-lg font-semibold text-orange-900 dark:text-orange-200 mb-2">
                Tính năng nhắc nhở chưa khả dụng
              </h2>
              <p className="text-sm text-orange-700 dark:text-orange-300">
                Tính năng này hiện không khả dụng cho tài khoản của bạn. Vui lòng liên hệ giáo viên để được hỗ trợ.
              </p>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  // Show locked content if user doesn't have capability
  if (!hasRemindersCapability) {
    return (
      <ProtectedRoute>
        {renderError(undefined, undefined, false)}
      </ProtectedRoute>
    );
  }

  // Kiểm tra lock trước để ưu tiên hiển thị lock content
  if (actionsLocked || planFeatureMessage) {
    return (
      <ProtectedRoute>
        {renderError()}
      </ProtectedRoute>
    );
  }

  // Show API errors
  if (error && !loading) {
    return (
      <ProtectedRoute>
        {renderError(error)}
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-[calc(100vh-120px)] bg-gradient-to-b from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white sm:text-2xl">Nhắc nhở</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Lịch học và thanh toán sắp tới</p>
          </div>

          <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 relative">
              <SelectInput
                label="Loại nhắc nhở"
                name="reminderType"
                value={reminderType}
                handleChange={(e) => {
                  setReminderType(e.target.value as "all" | "schedule" | "payment" | "assignment");
                  setCurrentPage(1);
                }}
                options={[
                  { value: "all", label: "Tất cả" },
                  { value: "schedule", label: "Lịch học" },
                  { value: "payment", label: "Thanh toán" },
                  { value: "assignment", label: "Bài tập" },
                ]}
              />

              <SelectInput
                label="Khoảng ngày tới"
                name="reminderDays"
                value={reminderDaysAhead.toString()}
                handleChange={(e) => {
                  setReminderDaysAhead(Number(e.target.value));
                  setCurrentPage(1);
                }}
                options={[
                  { value: "7", label: "7 ngày" },
                  { value: "14", label: "14 ngày" },
                  { value: "30", label: "30 ngày" },
                ]}
              />

              <SelectInput
                label="Lớp học"
                name="classId"
                value={selectedClassId}
                handleChange={(e) => {
                  setSelectedClassId(e.target.value);
                  setCurrentPage(1);
                }}
                options={[
                  { value: "", label: "Tất cả lớp" },
                  ...classesList,
                ]}
              />

              {(reminderType !== "all" || selectedClassId !== "" || reminderDaysAhead !== 7) && (
                <button
                  onClick={() => {
                    setReminderType("all");
                    setReminderDaysAhead(7);
                    setSelectedClassId("");
                    setCurrentPage(1);
                  }}
                  className="absolute -top-3 right-0 text-xs font-medium text-red-500 hover:text-red-700 bg-white dark:bg-gray-800 px-2 py-0.5 rounded-full border border-gray-100 dark:border-gray-700"
                >
                  Xóa bộ lọc
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
                  <div className="flex animate-pulse gap-4">
                    <div className="h-12 w-12 rounded-xl bg-gray-100 dark:bg-gray-700" />
                    <div className="flex-1 space-y-3">
                      <div className="h-4 w-1/3 rounded bg-gray-100 dark:bg-gray-700" />
                      <div className="h-3 w-3/4 rounded bg-gray-100 dark:bg-gray-700" />
                      <div className="h-3 w-1/2 rounded bg-gray-100 dark:bg-gray-700" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : remindersList.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <BellIcon className="h-8 w-8" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">Không có nhắc nhở nào</h2>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Bạn sẽ thấy các nhắc nhở học tập và thanh toán tại đây.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {remindersList.map((reminder: any, index: number) => {
                const targetUrl =
                  reminder.category === "payment" && isStudentUser
                    ? "/my-payments"
                    : reminder.action_url;

                const reminderId = getObjId(reminder);
                // Create unique key by combining id, category, and index to avoid duplicates
                const uniqueKey = `${reminderId}-${reminder.category || 'unknown'}-${index}`;

                return (
                  <ReminderCard
                    key={uniqueKey}
                    reminder={reminder}
                    targetUrl={targetUrl}
                    variant="default"
                  />
                );
              })}
            </div>
          )}

          {paginationMeta && paginationMeta.total > 0 && (
            <Pagination
              meta={paginationMeta as any}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
              itemLabel="nhắc nhở"
            />
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}

