"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useNotifications, useMarkNotificationAsRead } from "@/hooks/use-api";
import { PlusIcon, EyeIcon, BellIcon, CheckCircleIcon, XCircleIcon, PencilIcon, PaperAirplaneIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { useAuthorization } from "@/lib/authz";
import { useTutorGuard } from "@/hooks/use-role-guard";
import SelectInput from "@/components/FormElements/SelectInput";
import SearchInput from "@/components/FormElements/SearchInput";
import ButtonLink from "@/components/Common/ButtonLink";
import Button from "@/components/Common/Button";
import Pagination from "@/components/Common/Pagination";
import { useListPage } from "@/hooks/use-list-page";
import { useLockContext } from "@/contexts/lock-context";
import { useErrorDisplay } from "@/components/Common/ErrorDisplay";
import { ListSkeleton, StatsCardSkeleton } from "@/components/ui/loading";
import { getObjId } from "@/lib/id-utils";
export default function NotificationsPage() {
  const { actionsLocked, planFeatureMessage } = useLockContext();
  const { renderError } = useErrorDisplay("Quản lý thông báo");
  const router = useRouter();
  const { can } = useAuthorization();
  const { isBlocked } = useTutorGuard();

  useEffect(() => {
    // Also check permission
    if (typeof window !== "undefined" && !(can("view", "notification") || can("view_any", "notification"))) {
      router.replace('/403');
    }
  }, [can, router]);

  // Use combined hook for pagination and filters
  const {
    currentPage,
    setCurrentPage,
    filters,
    updateFilter,
    resetFilters,
    apiFilters,
  } = useListPage({
    defaultPage: 1,
    defaultPerPage: 10,
    filterKeys: ["status", "search", "read"],
    filterDefaults: {
      status: "all",
      search: "",
      read: "all",
    },
  });

  // Extract individual filters for easier access
  const statusFilter = filters.status || "all";
  const searchQuery = filters.search || "";
  const readFilter = (filters.read || "all") as "all" | "read" | "unread";

  // Separate state for search input (not synced with URL until search is triggered)
  const [searchInput, setSearchInput] = useState(searchQuery);

  // Sync searchInput with searchQuery when filter changes externally
  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  // Handle search button click or Enter key
  const handleSearch = () => {
    updateFilter("search", searchInput);
  };

  const notificationApiFilters = useMemo(() => {
    const filtersForApi: Record<string, any> = {
      per_page: apiFilters.per_page,
      page: apiFilters.page,
    };
    if (statusFilter !== "all") {
      filtersForApi.status = statusFilter;
    }
    if (searchQuery) {
      filtersForApi.search = searchQuery;
    }
    if (readFilter === "read") {
      filtersForApi.read = true;
    } else if (readFilter === "unread") {
      filtersForApi.unread = true;
    }
    return filtersForApi;
  }, [apiFilters.page, apiFilters.per_page, statusFilter, searchQuery, readFilter]);

  const { data: notifications, loading, error, refetch, refresh, meta: notificationsMeta, permissions } = useNotifications(actionsLocked ? undefined : notificationApiFilters);
  const { mutate: markAsRead } = useMarkNotificationAsRead();

  // Use permissions from API response
  const canView = permissions?.can_view ?? true; // Default true cho view
  const canManage = permissions?.can_manage ?? true; // Default true for backward compatibility
  const canSendCustom = permissions?.can_send_custom ?? false;

  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  const handleViewNotification = async (notification: any) => {
    // Auto-mark as read if not read yet
    if (!notification.is_read) {
      try {
        const notifId = getObjId(notification);
        await markAsRead(String(notifId));
        refetch();
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }
  };

  // Polling for the list if any notification is in 'processing' state
  useEffect(() => {
    const hasProcessing = !!notifications?.some((n: any) => n.status === 'processing');
    let interval: NodeJS.Timeout | null = null;

    if (hasProcessing) {
      interval = setInterval(() => {
        refresh();
      }, 8000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [notifications, refetch, refresh]);

  // Block students / thiếu quyền xem — sau tất cả hook để giữ hook order ổn định.
  // Effect ở đầu component lo phần điều hướng về /403.
  if (isBlocked || !(can("view", "notification") || can("view_any", "notification"))) {
    return null;
  }

  // Kiểm tra lock trước để ưu tiên hiển thị lock content
  if (actionsLocked || planFeatureMessage) {
    return renderError();
  }

  // Check view permission - chỉ block khi không có quyền xem
  if (!loading && permissions !== undefined && !canView) {
    return renderError(undefined, undefined, false);
  }

  if (error && !loading) {
    return renderError(error, () => refetch());
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white">Quản lý thông báo</h1>
          <p className="text-sm sm:text-base text-dark-4 dark:text-dark-6 mt-1">
            Quản lý và gửi thông báo đến học viên và phụ huynh
          </p>
        </div>

        <ButtonLink
          href="/notifications/create"
          icon={<PlusIcon />}
          size="sm"
          disabled={!canSendCustom}
        >
          <span className="hidden sm:inline">Tạo thông báo mới</span>
          <span className="sm:hidden">Tạo mới</span>
        </ButtonLink>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
        {loading ? (
          <>
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
          </>
        ) : (
          <>
            <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
              <div className="flex items-center">
                <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                  <BellIcon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                </div>
                <div className="ml-3 md:ml-4">
                  <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Tất cả">Tất cả</p>
                  <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                    {(notificationsMeta as any)?.statistics?.total ?? notificationsMeta?.total ?? 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
              <div className="flex items-center">
                <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                  <BellIcon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                </div>
                <div className="ml-3 md:ml-4">
                  <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Chưa đọc">Chưa đọc</p>
                  <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                    {(notificationsMeta as any)?.statistics?.unread ?? 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
              <div className="flex items-center">
                <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                  <CheckCircleIcon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                </div>
                <div className="ml-3 md:ml-4">
                  <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Đã gửi">Đã gửi</p>
                  <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                    {(notificationsMeta as any)?.statistics?.sent ?? 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
              <div className="flex items-center">
                <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                  <XCircleIcon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                </div>
                <div className="ml-3 md:ml-4">
                  <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Thất bại">Thất bại</p>
                  <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                    {(notificationsMeta as any)?.statistics?.failed ?? 0}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Search and Filters */}
      <div className="rounded-lg bg-white p-4 dark:bg-gray-800">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 relative">
          <SearchInput
            label="Tìm kiếm"
            name="search"
            placeholder="Tìm kiếm thông báo..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onSearch={handleSearch}
          />
          <SelectInput
            label="Trạng thái đọc"
            name="read"
            value={readFilter}
            onChange={(e) => updateFilter("read", e.target.value)}
            options={[
              { label: "Tất cả", value: "all" },
              { label: "Chưa đọc", value: "unread" },
              { label: "Đã đọc", value: "read" },
            ]}
          />
          <SelectInput
            label="Trạng thái gửi"
            name="status"
            value={statusFilter}
            onChange={(e) => updateFilter("status", e.target.value)}
            options={[
              { label: "Tất cả trạng thái", value: "all" },
              { label: "Bản nháp", value: "draft" },
              { label: "Đã lên lịch", value: "scheduled" },
              { label: "Đang xử lý", value: "processing" },
              { label: "Đã gửi", value: "sent" },
              { label: "Thất bại", value: "failed" },
            ]}
          />

          {(searchQuery || statusFilter !== "all" || readFilter !== "all") && (
            <button
              onClick={() => {
                setSearchInput("");
                resetFilters();
              }}
              className="absolute -top-3 right-0 text-xs font-medium text-red-500 hover:text-red-700 bg-white dark:bg-gray-800 px-2 py-0.5 rounded-full border border-gray-100 dark:border-gray-700"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      {loading ? (
        <ListSkeleton count={5} showAvatar={false} />
      ) : !notifications || notifications.length === 0 ? (
        <div className="rounded-lg bg-white p-6 sm:p-8 text-center dark:bg-gray-800">
          <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-3 sm:mb-4">
            <BellIcon className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400" />
          </div>
          <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-2">
            {searchQuery || statusFilter !== "all" ? "Không tìm thấy thông báo" : "Chưa có thông báo nào"}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 sm:mb-6">
            {searchQuery || statusFilter !== "all"
              ? "Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc"
              : "Bắt đầu bằng cách tạo thông báo đầu tiên"
            }
          </p>
          {!searchQuery && statusFilter === "all" && (
            <ButtonLink
              href="/notifications/create"
              icon={<PlusIcon />}
              size="sm"
              disabled={!canSendCustom}
            >
              <span className="hidden sm:inline">Tạo thông báo đầu tiên</span>
              <span className="sm:hidden">Tạo mới</span>
            </ButtonLink>
          )}
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {notifications?.map((notification: any) => {
            const notifId = getObjId(notification);
            const notifIdString = String(notifId);
            return (
              <div
                key={notifIdString}
                className="rounded-lg bg-white p-3 sm:p-4 md:p-6 transition-shadow dark:bg-gray-800"
              >
                <div className="flex flex-col gap-2 sm:gap-3 mb-2 sm:mb-3 md:mb-4">
                  {/* Title and Badge - Stack on mobile */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      {!notification.is_read && (
                        <span className="size-2 rounded-full bg-primary flex-shrink-0 mt-1.5 sm:mt-2" />
                      )}
                      <h3 className={`text-sm sm:text-base md:text-lg font-semibold break-words ${notification.is_read
                        ? 'text-gray-700 dark:text-gray-300'
                        : 'text-gray-900 dark:text-white'
                        }`}>
                        {notification.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 self-start sm:self-auto">
                      {notification.is_read && notification.read_at && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          Đã đọc {new Date(notification.read_at).toLocaleDateString('vi-VN')}
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${notification.status === 'sent'
                          ? 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]'
                          : notification.status === 'scheduled' || notification.status === 'processing'
                            ? 'bg-[var(--status-badge-pending)] text-[var(--status-badge-pending-text)]'
                            : notification.status === 'draft'
                              ? 'bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]'
                              : 'bg-[var(--status-badge-error)] text-[var(--status-badge-error-text)]'
                          }`}
                      >
                        {notification.status === 'sent'
                          ? 'Đã gửi'
                          : notification.status === 'scheduled'
                            ? 'Đã lên lịch'
                            : notification.status === 'processing'
                              ? (
                                <span className="flex items-center gap-1">
                                  <ArrowPathIcon className="h-3 w-3 animate-spin" />
                                  Đang xử lý
                                </span>
                              )
                              : notification.status === 'draft'
                                ? 'Bản nháp'
                                : 'Thất bại'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    <span>
                      Loại: {notification.type === 'announcement' ? 'Thông báo chung' :
                        notification.type === 'reminder' ? 'Nhắc nhở' :
                          notification.type === 'payment' ? 'Học phí' :
                            notification.type === 'attendance' ? 'Điểm danh' :
                              notification.type === 'grade' ? 'Điểm số' :
                                notification.type === 'other' ? 'Khác' :
                                  notification.type || "Thông báo chung"}
                    </span>
                    <span className="hidden sm:inline">•</span>
                    <span>
                      Đối tượng: {notification.target === 'student' ? 'Học viên' :
                        notification.target === 'tutor' ? 'Giáo viên' :
                          notification.target === 'all' ? 'Tất cả' :
                            notification.target || 'Tất cả'}
                    </span>
                  </div>
                </div>

                {(notification.content || notification.message) && (
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mb-2 sm:mb-3 md:mb-4 line-clamp-3 break-words">
                    {notification.content || notification.message}
                  </p>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                  <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-4 gap-y-1.5 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    {notification.recipient_type && (
                      <span>
                        <span className="font-medium">Loại:</span> {notification.recipient_type === 'all' ? 'Tất cả' :
                          notification.recipient_type === 'students' ? 'Học viên' :
                            notification.recipient_type === 'classes' ? 'Lớp học' :
                              notification.recipient_type}
                      </span>
                    )}
                    {notification.channel && (
                      <span>
                        <span className="font-medium">Kênh:</span> {notification.channel === 'email' ? 'Email' :
                          notification.channel === 'zalo' ? 'Zalo' :
                            notification.channel === 'sms' ? 'SMS' :
                              notification.channel === 'in_app' ? 'Trong ứng dụng' :
                                notification.channel}
                      </span>
                    )}
                    {notification.sent_count !== undefined && (
                      <span>
                        <span className="font-medium">Đã gửi:</span> {notification.sent_count}
                      </span>
                    )}
                    {notification.failed_count !== undefined && notification.failed_count > 0 && (
                      <span className="text-red-600 dark:text-red-400">
                        <span className="font-medium">Thất bại:</span> {notification.failed_count}
                      </span>
                    )}
                    <span>
                      <span className="font-medium">Ngày:</span> {new Date(notification.created_at).toLocaleDateString('vi-VN')}
                    </span>
                    {notification.sent_at && (
                      <span>
                        <span className="font-medium">Đã gửi:</span> {new Date(notification.sent_at).toLocaleDateString('vi-VN')}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
                    <ButtonLink
                      href={`/notifications/${notifIdString}`}
                      onClick={() => handleViewNotification(notification)}
                      variant="outline"
                      size="sm"
                      icon={<EyeIcon />}
                      className="flex-1 sm:flex-initial justify-center"
                    >
                      <span className="hidden sm:inline">Xem thông báo</span>
                      <span className="sm:hidden">Thông báo</span>
                    </ButtonLink>
                    <ButtonLink
                      href={`/notifications/${notifIdString}/edit`}
                      variant="outline"
                      size="sm"
                      icon={<PencilIcon />}
                      className="flex-1 sm:flex-initial justify-center"
                      disabled={!canManage}
                    >
                      <span className="sm:hidden">Chỉnh sửa</span>
                      <span className="hidden sm:inline">Chỉnh sửa</span>
                      <span className="sr-only sm:hidden">Chỉnh sửa</span>
                    </ButtonLink>
                    {notification.status === 'pending' && (
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<PaperAirplaneIcon />}
                        className="w-full sm:w-auto justify-center"
                        disabled={!canManage}
                      >
                        <span className="hidden sm:inline">Gửi ngay</span>
                        <span className="sm:hidden">Gửi</span>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination - chỉ hiển thị khi có dữ liệu */}
      {notifications && notifications.length > 0 && (
        <Pagination
          meta={notificationsMeta}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          itemLabel="thông báo"
          className="mt-6"
        />
      )}
    </div>
  );
}
