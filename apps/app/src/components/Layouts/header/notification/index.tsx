"use client";

import {
  Dropdown,
  DropdownContent,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { BellIcon } from "./icons";
import { useUnreadNotifications, useMarkNotificationAsRead } from "@/hooks/use-api";
import Tooltip from "@/components/Common/Tooltip";
import { getObjId } from "@/lib/id-utils";
import { useFaviconBadge } from "@/hooks/use-favicon-badge";

export function Notification() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();
  const { data: unreadData, loading: unreadLoading, refetch: refetchUnread } = useUnreadNotifications();
  const { mutate: markAsRead } = useMarkNotificationAsRead();

  const notifications = unreadData?.notifications || (Array.isArray(unreadData) ? unreadData : []);
  const unreadCount = unreadData?.count ?? unreadData?.unread_count ?? (Array.isArray(notifications) ? notifications.length : 0);

  // Update Favicon with unread count
  useFaviconBadge(unreadCount);

  useEffect(() => {
    if (isOpen) {
      refetchUnread();
    }
  }, [isOpen, refetchUnread]);

  const handleNotificationClick = async (notification: any) => {
    // Auto-mark as read if not read yet
    if (!notification.is_read) {
      try {
        const notifId = notification.hashid || notification._id || getObjId(notification);
        await markAsRead(String(notifId));
        // Refetch to update UI
        refetchUnread();
      } catch (error) {
        // Silently fail - don't block navigation
        console.error('Failed to mark notification as read:', error);
      }
    }
  };

  return (
    <Dropdown
      isOpen={isOpen}
      setIsOpen={setIsOpen}
    >
      <Tooltip label="Xem thông báo">
        <DropdownTrigger
          className="grid size-10 place-items-center rounded-full border bg-gray-2 text-dark outline-none hover:text-primary focus-visible:border-primary focus-visible:text-primary dark:border-dark-4 dark:bg-dark-3 dark:text-white dark:focus-visible:border-primary sm:size-12"
          aria-label="Xem thông báo"
        >
          <span className="relative">
            <BellIcon />

            {unreadCount > 0 && (
              <span
                className={cn(
                  "absolute right-0 top-0 z-1 size-2 rounded-full bg-red-light ring-2 ring-gray-2 dark:ring-dark-3",
                )}
              >
                <span className="absolute inset-0 -z-1 animate-ping rounded-full bg-red-light opacity-75" />
              </span>
            )}
          </span>
        </DropdownTrigger>
      </Tooltip>

      <DropdownContent
        align={isMobile ? "end" : "center"}
        className="border border-stroke bg-white px-3.5 py-3 shadow-md dark:border-dark-3 dark:bg-gray-dark min-[350px]:min-w-[20rem]"
      >
        <div className="mb-1 flex items-center justify-between px-2 py-1.5">
          <span className="text-lg font-medium text-dark dark:text-white">
            Thông báo
          </span>
          {unreadCount > 0 && (
            <span className="rounded-md bg-primary px-[9px] py-0.5 text-xs font-medium text-white">
              {unreadCount} mới
            </span>
          )}
        </div>

        {unreadLoading && !unreadData ? (
          <ul className="mb-3 max-h-[23rem] space-y-1.5 overflow-y-auto">
            {[...Array(3)].map((_, index) => (
              <li key={`skeleton-${index}`} role="menuitem">
                <div className="flex items-center gap-4 rounded-lg px-2 py-1.5">
                  <Skeleton className="size-14 rounded-full flex-shrink-0" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : notifications.length === 0 ? (
          <div className="mb-3 flex flex-col items-center justify-center py-8 text-center">
            <BellIcon className="mb-2 size-8 text-gray-400 dark:text-gray-500" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Chưa có thông báo nào</p>
          </div>
        ) : (
          <ul className="mb-3 max-h-[23rem] space-y-1.5 overflow-y-auto">
            {notifications.slice(0, 10).map((notification: any) => {
              const creatorAvatar = notification.creator?.avatar_media?.url
                || notification.creator?.avatar
                || '/images/user/default-avatar.png';
              const title = notification.title || notification.subject || 'Thông báo mới';
              const message = notification.message || notification.body || '';
              const date = notification.created_at
                ? new Date(notification.created_at).toLocaleString('vi-VN', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })
                : '';

              const isUnread = !notification.is_read;

              // Prioritize HashID
              const notifId = notification.hashid || notification._id || getObjId(notification);
              const notifIdString = String(notifId);

              return (
                <li key={notifIdString} role="menuitem">
                  <Link
                    href={notification.url || `/notifications/${notifIdString}`}
                    onClick={async (e) => {
                      e.preventDefault();
                      setIsOpen(false);
                      // Mark as read then navigate
                      await handleNotificationClick(notification);
                      const targetUrl = notification.url || `/notifications/${notifIdString}`;
                      router.push(targetUrl);
                    }}
                    className={cn(
                      "flex items-center gap-4 rounded-lg px-2 py-1.5 outline-none transition-colors",
                      isUnread
                        ? "bg-primary/5 hover:bg-primary/10 dark:bg-primary/10 dark:hover:bg-primary/20"
                        : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    )}
                  >
                    <div className="relative flex-shrink-0">
                      <Image
                        src={creatorAvatar}
                        className="size-14 rounded-full object-cover"
                        width={56}
                        height={56}
                        alt={notification.creator?.name || 'User'}
                        onError={(e) => {
                          e.currentTarget.src = '/images/user/default-avatar.png';
                        }}
                      />
                      {isUnread && (
                        <span className="absolute right-0 top-0 size-3 rounded-full bg-primary ring-2 ring-white dark:ring-gray-dark" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <strong className="block text-sm font-medium text-dark dark:text-white">
                        {title}
                      </strong>
                      {message && (
                        <span className="truncate block text-sm font-medium text-dark-5 dark:text-dark-6">
                          {message}
                        </span>
                      )}
                      {date && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {date}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {!unreadLoading && notifications.length > 0 && (
          <Link
            href="/notifications"
            onClick={() => setIsOpen(false)}
            className="block rounded-lg border border-primary p-2 text-center text-sm font-medium tracking-wide text-primary outline-none transition-colors hover:bg-blue-light-5 focus:bg-blue-light-5 focus:text-primary focus-visible:border-primary dark:border-dark-3 dark:text-dark-6 dark:hover:border-dark-5 dark:hover:bg-dark-3 dark:hover:text-dark-7 dark:focus-visible:border-dark-5 dark:focus-visible:bg-dark-3 dark:focus-visible:text-dark-7"
          >
            Xem tất cả thông báo
          </Link>
        )}
      </DropdownContent>
    </Dropdown>
  );
}
