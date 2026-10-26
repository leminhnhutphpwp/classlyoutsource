"use client";
import { useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  BellIcon,
  CalendarIcon,
  EyeIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { useNotification, useMarkNotificationAsRead } from "@/hooks/use-api";
import { useGoBack } from "@/hooks/use-go-back";
import { useRoleGuard } from "@/hooks/use-role-guard";
import {
  formatRelativeTime,
  getChannelLabel,
  getNotificationTypeMeta,
  getTargetLabel,
  getNotificationActionUrl,
  getNotificationActionLabel,
} from "@/components/Notifications/student-notification-helpers";
import ButtonLink from "@/components/Common/ButtonLink";
import Button from "@/components/Common/Button";

export default function StudentNotificationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const notificationId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const handleGoBack = useGoBack('/my-notifications');

  const { isBlocked } = useRoleGuard({ allowedRoles: ["student"] });
  const { data: notification, loading, error, refetch } = useNotification(notificationId || "");
  const { mutate: markAsRead } = useMarkNotificationAsRead();
  const markedNotificationIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!notification || notification.is_read || !notificationId) return;
    if (markedNotificationIds.current.has(notificationId)) return;

    markedNotificationIds.current.add(notificationId);
    let isMounted = true;

    const markNotification = async () => {
      const response = await markAsRead(notificationId);
      if (response?.success && isMounted) {
        refetch();
      }
    };

    markNotification();

    return () => {
      isMounted = false;
    };
  }, [notification, notificationId, markAsRead, refetch]);

  if (isBlocked) {
    return null;
  }

  if (!notificationId) {
    router.replace("/my-notifications");
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-120px)] bg-gradient-to-b from-gray-50 via-white to-gray-50 px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          <div className="flex flex-col gap-1">
            <div className="h-7 w-48 rounded bg-gray-200 animate-pulse" />
            <div className="h-4 w-64 rounded bg-gray-200 animate-pulse" />
          </div>

          <div className="gap-6 lg:grid lg:grid-cols-[260px,minmax(0,1fr)]">
            <aside className="space-y-4">
              <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                <div className="h-10 w-full rounded-xl bg-gray-100 animate-pulse" />
                <div className="h-10 w-full rounded-xl bg-gray-100 animate-pulse" />
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-4">
                <div className="space-y-2">
                  <div className="h-3 w-20 rounded bg-gray-100 animate-pulse" />
                  <div className="h-5 w-32 rounded bg-gray-100 animate-pulse" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-20 rounded bg-gray-100 animate-pulse" />
                  <div className="h-5 w-32 rounded bg-gray-100 animate-pulse" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-20 rounded bg-gray-100 animate-pulse" />
                  <div className="h-5 w-24 rounded bg-gray-100 animate-pulse" />
                </div>
              </div>
            </aside>

            <main>
              <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-lg">
                <div className="space-y-4 animate-pulse">
                  <div className="h-6 w-3/4 rounded bg-gray-100" />
                  <div className="h-4 w-1/2 rounded bg-gray-100" />
                  <div className="flex gap-2">
                    <div className="h-6 w-20 rounded-full bg-gray-100" />
                    <div className="h-6 w-16 rounded-full bg-gray-100" />
                  </div>
                  <div className="h-32 w-full rounded-2xl bg-gray-100" />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="h-16 rounded-2xl bg-gray-100" />
                    <div className="h-16 rounded-2xl bg-gray-100" />
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    );
  }

  if (error || !notification) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-600 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
        <p>{error || "Không tìm thấy thông báo."}</p>
        <Button
          onClick={handleGoBack}
          variant="outline"
          size="sm"
          icon={<ArrowLeftIcon />}
        >
          Quay lại bảng tin
        </Button>
      </div>
    );
  }

  const typeMeta = getNotificationTypeMeta(notification.type);

  const createdAtLabel = new Date(notification.created_at).toLocaleString("vi-VN");
  const sentAtLabel = notification.sent_at
    ? new Date(notification.sent_at).toLocaleString("vi-VN")
    : null;

  const sidebarInfo = [
    {
      label: "Ngày tạo",
      value: createdAtLabel,
      icon: CalendarIcon,
    },
    ...(sentAtLabel
      ? [
        {
          label: "Ngày gửi",
          value: sentAtLabel,
          icon: CalendarIcon,
        },
      ]
      : []),
    {
      label: "Đối tượng",
      value: getTargetLabel(notification.target),
      icon: InformationCircleIcon,
    },
    ...(notification.channel
      ? [
        {
          label: "Kênh gửi",
          value: getChannelLabel(notification.channel),
          icon: InformationCircleIcon,
        },
      ]
      : []),
  ];

  return (
    <div className="min-h-[calc(100vh-120px)] bg-gradient-to-b from-gray-50 via-white to-gray-50 px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl">Chi tiết thông báo</h1>
          <p className="text-sm text-gray-500">Xem nội dung và thông tin gửi cho bạn</p>
        </div>

        <div className="gap-6 lg:grid lg:grid-cols-[260px,minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
              <ButtonLink
                href="/my-notifications"
                variant="outline"
                size="sm"
                icon={<ArrowLeftIcon />}
                className="w-full"
              >
                Quay lại bảng tin
              </ButtonLink>
              <div
                className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold ${notification.is_read
                  ? "border-gray-200 text-gray-500"
                  : "border-primary/40 bg-primary/5 text-primary"
                  }`}
              >
                <BellIcon className="h-4 w-4" />
                {notification.is_read ? "Đã đọc" : "Chưa đọc"}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3 text-sm text-gray-600">
              {sidebarInfo.map((item, idx) => (
                <div key={item.label} className={`flex items-start gap-3 rounded-2xl ${idx % 2 === 0 ? "bg-gray-50" : "bg-white"} px-3 py-3`}>
                  <div className="rounded-xl bg-white p-2">
                    <item.icon className="h-5 w-5 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">{item.label}</p>
                    <p className="text-sm font-medium text-gray-900">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <article className="rounded-3xl border border-gray-100 bg-white p-6 shadow-lg">
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm text-gray-500">{formatRelativeTime(notification.created_at)}</p>
                <h2 className="mt-2 text-2xl font-semibold text-gray-900">{notification.title}</h2>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                  <span className={`inline-flex items-center rounded-full px-3 py-1 font-medium ring-1 ${typeMeta.badgeClass}`}>
                    <typeMeta.icon className="mr-1 h-4 w-4" />
                    {typeMeta.label}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-600">
                    <InformationCircleIcon className="h-4 w-4" />
                    {notification.status === "sent"
                      ? "Đã gửi"
                      : notification.status === "scheduled"
                        ? "Đã lên lịch"
                        : notification.status === "processing"
                          ? "Đang xử lý"
                          : notification.status === "failed"
                            ? "Thất bại"
                            : notification.status === "draft"
                              ? "Bản nháp"
                              : notification.status || "Không xác định"}
                  </span>
                </div>
              </div>

              {(notification.content || notification.message) && (
                <div className="rounded-2xl bg-gray-50 px-4 py-5 text-gray-700">
                  {notification.content || notification.message}
                </div>
              )}

              {getNotificationActionUrl(notification) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <ButtonLink
                    href={getNotificationActionUrl(notification)!}
                    variant="primary"
                    size="md"
                    icon={<EyeIcon />}
                  >
                    {getNotificationActionLabel(notification) || "Xem thông báo"}
                  </ButtonLink>
                </div>
              )}
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}


