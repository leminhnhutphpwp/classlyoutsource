"use client";
import { useMemo, useState, useCallback, useEffect } from "react";
import {
  BellIcon,
  CheckBadgeIcon,
} from "@heroicons/react/24/outline";
import { useNotifications, useMarkNotificationAsRead } from "@/hooks/use-api";
import { useRoleGuard } from "@/hooks/use-role-guard";
import { useLockContext } from "@/contexts/lock-context";
import ProtectedRoute from "@/components/Auth/ProtectedRoute";
import { useErrorDisplay } from "@/components/Common/ErrorDisplay";
import { notificationTypeFilters } from "@/components/Notifications/student-notification-helpers";
import Button from "@/components/Common/Button";
import SelectInput from "@/components/FormElements/SelectInput";
import SearchInput from "@/components/FormElements/SearchInput";
import Pagination from "@/components/Common/Pagination";
import { useListPage } from "@/hooks/use-list-page";
import { NotificationCard } from "@/components/Notifications/NotificationCard";
import { getObjId } from "@/lib/id-utils";

function isNotificationForStudent(notification: any) {
  if (!notification) return false;
  if (!notification.target || notification.target === "student" || notification.target === "all") {
    return true;
  }
  if (notification.recipient_type === "students" || notification.recipient_type === "all") {
    return true;
  }
  if (Array.isArray(notification.targets)) {
    return notification.targets.includes("student") || notification.targets.includes("all");
  }
  return false;
}

export default function StudentNotificationsFeedPage() {
  const { isBlocked } = useRoleGuard({ allowedRoles: ["student"] });
  const { actionsLocked, planFeatureMessage } = useLockContext();
  const { renderError } = useErrorDisplay("Bảng tin thông báo");

  // Use combined hook for pagination and filters (synchronized with URL)
  const {
    currentPage,
    setCurrentPage,
    filters,
    updateFilter,
    apiFilters,
  } = useListPage({
    defaultPage: 1,
    defaultPerPage: 10,
    filterKeys: ["search", "read", "type"],
    filterDefaults: {
      search: "",
      read: "all",
      type: "all",
    },
  });

  // Extract individual filters for easier access
  const searchQuery = filters.search || "";
  const readFilter = (filters.read || "all") as "all" | "read" | "unread";
  const typeFilter = filters.type || "all";

  // Separate state for search input (not synced with URL until search is triggered)
  const [searchInput, setSearchInput] = useState(searchQuery);

  // Sync searchInput with searchQuery when filter changes externally
  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  // Handle search button click or Enter key
  const handleSearch = useCallback(() => {
    updateFilter("search", searchInput);
  }, [searchInput, updateFilter]);

  // Build API filters
  const notificationApiFilters = useMemo(() => {
    const filtersForApi: Record<string, any> = {
      per_page: apiFilters.per_page,
      page: apiFilters.page,
    };
    if (searchQuery) {
      filtersForApi.search = searchQuery;
    }
    if (readFilter === "unread") {
      filtersForApi.unread = true;
    } else if (readFilter === "read") {
      filtersForApi.read = true;
    }
    if (typeFilter !== "all") {
      filtersForApi.type = typeFilter;
    }
    return filtersForApi;
  }, [apiFilters.page, apiFilters.per_page, searchQuery, readFilter, typeFilter]);

  const { data: notifications, loading, error, refetch, meta: notificationsMeta, permissions } = useNotifications(notificationApiFilters);
  const { mutate: markAsRead } = useMarkNotificationAsRead();

  const [processingId, setProcessingId] = useState<string | undefined>(undefined);
  const [bulkMarking, setBulkMarking] = useState(false);

  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  // Filter notifications for students (client-side filtering for target)
  const feedItems = useMemo(() => {
    const data = Array.isArray(notifications)
      ? notifications.filter(isNotificationForStudent)
      : [];
    return data.sort(
      (a: any, b: any) =>
        new Date(b.created_at || b.updated_at || 0).getTime() -
        new Date(a.created_at || a.updated_at || 0).getTime()
    );
  }, [notifications]);

  // Calculate unread count from all notifications (not filtered)
  const unreadCount = useMemo(() => {
    const allStudentNotifications = Array.isArray(notifications)
      ? notifications.filter(isNotificationForStudent)
      : [];
    return allStudentNotifications.filter((item: any) => !item.is_read).length;
  }, [notifications]);

  const handleMarkAsRead = useCallback(
    async (notificationId: string) => {
      setProcessingId(notificationId);
      try {
        const response = await markAsRead(notificationId);
        if (response?.success) {
          refetch();
        }
      } finally {
        setProcessingId(undefined);
      }
    },
    [markAsRead, refetch]
  );

  const handleMarkAllAsRead = useCallback(async () => {
    if (unreadCount === 0) return;
    setBulkMarking(true);
    try {
      for (const notification of feedItems) {
        if (!notification.is_read) {
          const notifId = getObjId(notification);
          await markAsRead(String(notifId));
        }
      }
      refetch();
    } finally {
      setBulkMarking(false);
      setProcessingId(undefined);
    }
  }, [feedItems, markAsRead, refetch, unreadCount]);

  if (isBlocked) {
    return null;
  }

  // Use permissions from API response
  const canView = permissions?.can_view ?? true; // Default true cho view

  // Kiểm tra lock trước để ưu tiên hiển thị lock content
  if (actionsLocked || planFeatureMessage) {
    return (
      <ProtectedRoute>
        {renderError()}
      </ProtectedRoute>
    );
  }

  // Check view permission - chỉ block khi không có quyền xem
  if (!loading && permissions !== undefined && !canView) {
    return (
      <ProtectedRoute>
        {renderError(undefined, undefined, false)}
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-[calc(100vh-120px)] bg-gradient-to-b from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white sm:text-2xl">Bảng tin thông báo</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Các cập nhật học tập mới nhất dành cho bạn</p>
          </div>

          <div className="gap-6 lg:grid lg:grid-cols-[260px,minmax(0,1fr)]">
            <aside className="space-y-4">
              <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                <SearchInput
                  label="Tìm kiếm"
                  name="search"
                  placeholder="Tìm kiếm thông báo..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onSearch={handleSearch}
                />
              </div>

              <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
                {loading ? (
                  <div className="space-y-3 animate-pulse">
                    <div>
                      <div className="h-3 w-16 rounded bg-gray-200 dark:bg-gray-700 mb-2" />
                      <div className="h-8 w-12 rounded bg-gray-200 dark:bg-gray-700 mb-2" />
                      <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-700" />
                    </div>
                    <div className="h-9 w-full rounded bg-gray-200 dark:bg-gray-700" />
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="text-xs uppercase text-gray-400 dark:text-gray-500">Chưa đọc</p>
                      <p className="text-2xl font-semibold text-primary">{unreadCount}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Thông báo chưa xem</p>
                    </div>
                    <Button
                      onClick={handleMarkAllAsRead}
                      disabled={bulkMarking || unreadCount === 0}
                      variant="outline"
                      size="sm"
                      icon={<CheckBadgeIcon />}
                      className="w-full"
                    >
                      Đánh dấu tất cả đã đọc
                    </Button>
                  </>
                )}
              </div>

              <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
                <SelectInput
                  label="Hiển thị"
                  name="readFilter"
                  value={readFilter}
                  handleChange={(e) => updateFilter("read", e.target.value)}
                  options={[
                    { value: "all", label: "Tất cả" },
                    { value: "unread", label: "Chưa đọc" },
                    { value: "read", label: "Đã đọc" },
                  ]}
                />
              </div>

              <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-2">
                <SelectInput
                  label="Loại thông báo"
                  name="typeFilter"
                  value={typeFilter}
                  handleChange={(e) => updateFilter("type", e.target.value)}
                  options={notificationTypeFilters.map((filter) => ({
                    value: filter.value,
                    label: filter.label,
                  }))}
                />
              </div>
            </aside>

            <section className="space-y-5">
              {error && (
                <div className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-red-600 dark:text-red-400">{error}</div>
              )}

              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={`skeleton-${index}`} className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
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
              ) : feedItems.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-10 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <BellIcon className="h-8 w-8" />
                  </div>
                  <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                    {searchQuery || readFilter !== "all" || typeFilter !== "all"
                      ? "Không tìm thấy thông báo"
                      : "Không có thông báo nào"}
                  </h2>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    {searchQuery || readFilter !== "all" || typeFilter !== "all"
                      ? "Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc"
                      : "Bạn sẽ thấy bài đăng mới từ gia sư ngay tại đây."}
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {feedItems.map((notification: any) => {
                    const notifId = getObjId(notification);
                    const notifIdString = String(notifId);
                    return (
                      <NotificationCard
                        key={notifIdString}
                        notification={notification}
                        onMarkAsRead={(id) => handleMarkAsRead(String(id))}
                        processingId={processingId}
                        bulkMarking={bulkMarking}
                      />
                    );
                  })}
                </div>
              )}

              {feedItems && feedItems.length > 0 && notificationsMeta && (
                <div className="mt-6">
                  <Pagination
                    meta={notificationsMeta}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                    itemLabel="thông báo"
                  />
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}