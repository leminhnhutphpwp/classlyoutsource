"use client";

import { ReactNode, memo } from "react";
import { CheckBadgeIcon, EyeIcon } from "@heroicons/react/24/outline";
import Button from "@/components/Common/Button";
import ButtonLink from "@/components/Common/ButtonLink";
import { useAuthorization, isStudent as isStudentUser } from "@/lib/authz";
import {
  formatRelativeTime,
  getChannelLabel,
  getNotificationActionLabel,
  getNotificationActionUrl,
  getNotificationTypeMeta,
  getTargetLabel,
} from "./student-notification-helpers";
import { getObjId } from "@/lib/id-utils";

interface NotificationData {
  id: string | number;
  _id?: string | number; // Fallback for backend ID format
  type: string;
  title: string;
  content?: string;
  message?: string;
  is_read: boolean;
  created_at: string;
  updated_at?: string;
  sent_at?: string;
  target?: string;
  channel?: string;
}

interface NotificationCardProps {
  notification: NotificationData;
  onMarkAsRead?: (id: string | number) => void;
  processingId?: string | number;
  bulkMarking?: boolean;
  actions?: ReactNode;
  className?: string;
}

function NotificationCardComponent({
  notification,
  onMarkAsRead,
  processingId,
  bulkMarking = false,
  actions,
  className = "",
}: NotificationCardProps) {
  const meta = getNotificationTypeMeta(notification.type);
  const notificationId = getObjId(notification);
  const notificationIdString = String(notificationId);
  const isProcessing = processingId === notificationIdString;
  const actionUrl = getNotificationActionUrl(notification);
  const actionLabel = getNotificationActionLabel(notification);
  const { user } = useAuthorization();
  const isStudent = user ? isStudentUser(user) : false;
  const detailHref = isStudent
    ? `/my-notifications/${notificationIdString}`
    : `/notifications/${notificationIdString}`;

  return (
    <article
      className={`rounded-2xl border bg-white dark:bg-gray-800 p-5 transition hover:shadow-lg ${notification.is_read
        ? "border-gray-100 dark:border-gray-700"
        : "border-primary/30 dark:border-primary/50"
        } ${className}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl ${meta.badgeClass}`}
        >
          <meta.icon className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              {!notification.is_read && (
                <span className="h-2.5 w-2.5 rounded-full bg-primary" />
              )}
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                {notification.title}
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatRelativeTime(notification.created_at)}
            </p>
            <span
              className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium ring-1 ${meta.badgeClass}`}
            >
              {meta.label}
            </span>
          </div>

          {(notification.content || notification.message) && (
            <p className="mt-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
              {notification.content || notification.message}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
            <span>
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                Đối tượng:
              </span>{" "}
              {getTargetLabel(notification.target)}
            </span>
            {notification.channel && (
              <span>
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  Kênh:
                </span>{" "}
                {getChannelLabel(notification.channel)}
              </span>
            )}
            {notification.sent_at && (
              <span>
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  Đã gửi:
                </span>{" "}
                {new Date(notification.sent_at).toLocaleString("vi-VN")}
              </span>
            )}
          </div>

          {actions ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-gray-400 dark:text-gray-500">
                Cập nhật{" "}
                {formatRelativeTime(
                  notification.updated_at || notification.created_at
                )}
              </div>
              {actions}
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-gray-400 dark:text-gray-500">
                Cập nhật{" "}
                {formatRelativeTime(
                  notification.updated_at || notification.created_at
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {onMarkAsRead && (
                  <Button
                    onClick={() => onMarkAsRead(notificationIdString)}
                    disabled={
                      notification.is_read ||
                      isProcessing ||
                      bulkMarking
                    }
                    variant={notification.is_read ? "ghost" : "outline"}
                    size="sm"
                    icon={<CheckBadgeIcon />}
                    loading={isProcessing}
                  >
                    {notification.is_read ? "Đã đọc" : "Đánh dấu đã đọc"}
                  </Button>
                )}
                {actionUrl && (
                  <ButtonLink
                    href={actionUrl}
                    variant="primary"
                    size="sm"
                    icon={<EyeIcon />}
                  >
                    {actionLabel || "Xem thông báo"}
                  </ButtonLink>
                )}
                <ButtonLink
                  href={detailHref}
                  variant={actionUrl ? "outline" : "primary"}
                  size="sm"
                  icon={<EyeIcon />}
                >
                  Xem thông báo
                </ButtonLink>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export const NotificationCard = memo(NotificationCardComponent);
