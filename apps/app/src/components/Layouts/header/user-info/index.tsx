"use client";

import { ChevronUpIcon } from "@/assets/icons";
import {
  Dropdown,
  DropdownContent,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuthContext } from "@/contexts/auth-context";
import { roleLabel, roleColorKey } from "@/lib/role-label";
import { LogOutIcon, SettingsIcon, UserIcon } from "./icons";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AcademicCapIcon,
  ClipboardDocumentListIcon,
  CalendarIcon,
  ChartBarIcon,
  BanknotesIcon,
} from "@heroicons/react/24/outline";
import { CheckBadgeIcon as CheckBadgeIconSolid } from "@heroicons/react/24/solid";
import { AvatarFrame } from "@/components/User/AvatarFrame";
import { isTutor } from "@/lib/permissions-utils";
import Tooltip from "@/components/Common/Tooltip";

export function UserInfo() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, loading, logout } = useAuthContext();
  const router = useRouter();
  const pathname = usePathname();

  // Check if user is tutor
  const isTutorUser = user ? isTutor(user) : false;

  const getItemClass = (path: string) => cn(
    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[9px] transition-colors",
    pathname === path || pathname?.startsWith(path + "/")
      ? "bg-gray-2 text-dark dark:bg-dark-3 dark:text-white"
      : "text-[#4B5563] dark:text-dark-6 hover:bg-gray-2 hover:text-dark dark:hover:bg-dark-3 dark:hover:text-white"
  );

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
    router.push('/auth/sign-in');
  };

  // Show default state while loading
  if (loading) {
    return (
      <div className="flex items-center gap-2 sm:gap-3">
        <Skeleton className="size-10 rounded-full sm:size-12" />
        <div className="hidden max-w-[120px] space-y-2 max-[1024px]:sr-only">
          <Skeleton className="h-4 w-24 rounded" />
        </div>
      </div>
    );
  }

  const userName = user?.name || user?.email?.split('@')[0] || 'Người dùng';
  const userEmail = user?.email || '';
  const userAvatar = user?.avatar || '/images/user/default-avatar.png';

  // Truncate user name if too long (max 20 characters)
  const displayName = userName.length > 20 ? `${userName.substring(0, 20)}...` : userName;

  // Nhãn vai trò LẤY TỪ BACKEND (`role_label` trong /auth/me), không tự map từ `user.role`.
  //
  // Lý do: theo thiết kế tổ chức, mọi thành viên trung tâm đều có users.role = 'tutor' — kể cả
  // chủ trung tâm, quản lý học vụ và kế toán. Map từ `role` thì cả bốn vai đều ra "Giáo viên".
  // Backend đã tính sẵn từ `organization_members.org_role`; ở đây chỉ chọn màu.
  const getRoleBadge = (u: any) => {
    const palette: Record<string, string> = {
      admin: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
      owner: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
      manager: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800',
      accountant: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800',
      tutor: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800',
      student: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
      parent: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
      default: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
    };

    return { label: roleLabel(u), className: palette[roleColorKey(u)] ?? palette.default };
  };

  const roleInfo = getRoleBadge(user);

  return (
    <Dropdown isOpen={isOpen} setIsOpen={setIsOpen}>
      <DropdownTrigger className="rounded align-middle outline-none ring-primary ring-offset-2 focus-visible:ring-1 dark:ring-offset-gray-dark">
        <span className="sr-only">Tài khoản của tôi</span>

        <figure className="flex items-center gap-2 sm:gap-3">
          <AvatarFrame level={0}>
            <div className="size-10 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700 sm:size-10">
              {userAvatar ? (
                <Image
                  src={userAvatar}
                  className="size-10 object-cover sm:size-12"
                  alt={`Avatar of ${userName}`}
                  role="presentation"
                  width={48}
                  height={48}
                  onError={(e) => {
                    e.currentTarget.src = '/images/user/default-avatar.png';
                  }}
                />
              ) : (
                <div className="flex size-10 items-center justify-center text-base font-semibold text-gray-600 dark:text-gray-300 sm:size-12 sm:text-lg">
                  {userName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </AvatarFrame>
          <figcaption className="flex items-center gap-3 max-[1024px]:sr-only">
            <div className="flex flex-col items-start gap-0.5">
              <span
                className="font-medium text-dark dark:text-dark-6 truncate max-w-[120px] sm:max-w-[150px] leading-tight"
                title={userName !== displayName ? userName : undefined}
              >
                {displayName}
              </span>
              <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border leading-none", roleInfo.className)}>
                {roleInfo.label}
              </span>
            </div>

            <ChevronUpIcon
              aria-hidden
              className={cn(
                "rotate-180 transition-transform flex-shrink-0 text-gray-500",
                isOpen && "rotate-0",
              )}
              strokeWidth={1.5}
            />
          </figcaption>
        </figure>
      </DropdownTrigger>

      <DropdownContent
        className="border border-stroke bg-white shadow-md dark:border-dark-3 dark:bg-gray-dark w-80 overflow-hidden"
        align="end"
      >
        <div className="relative">
          {/* User Info Menu */}
          <div className="transition-transform duration-300 ease-in-out">
            <h2 className="sr-only">Thông tin người dùng</h2>

            <figure className="flex items-center gap-2.5 px-5 py-3.5">
              <AvatarFrame level={0}>
                <div className="size-10 shrink-0 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700 sm:size-10">
                  {userAvatar ? (
                    <Image
                      src={userAvatar}
                      className="size-10 object-cover sm:size-12"
                      alt={`Avatar for ${userName}`}
                      role="presentation"
                      width={48}
                      height={48}
                      onError={(e) => {
                        e.currentTarget.src = '/images/user/default-avatar.png';
                      }}
                    />
                  ) : (
                    <div className="flex size-10 items-center justify-center text-base font-semibold text-gray-600 dark:text-gray-300 sm:size-12 sm:text-lg">
                      {userName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </AvatarFrame>

              <figcaption className="min-w-0 flex-1 space-y-1 text-base font-medium">
                <div className="mb-2 truncate leading-none text-dark dark:text-white" title={userName}>
                  {userName}
                </div>

                {userEmail && (
                  <div className="flex items-center gap-1.5">
                    <div className="truncate text-gray-6 sm:text-sm leading-relaxed" title={userEmail}>{userEmail}</div>
                    {user?.email_verified ? (
                      <Tooltip label="Đã xác thực">
                        <CheckBadgeIconSolid className="h-3.5 w-3.5 text-green-500 dark:text-green-400 flex-shrink-0" />
                      </Tooltip>
                    ) : (
                      <Tooltip label="Chưa xác thực">
                        <CheckBadgeIconSolid className="h-3.5 w-3.5 text-gray-400 dark:text-gray-600 flex-shrink-0 opacity-50" />
                      </Tooltip>
                    )}
                  </div>
                )}
              </figcaption>
            </figure>

            <hr className="border-[#E8E8E8] dark:border-dark-3" />

            {/* Tutor Menu */}
            {(user?.role === 'tutor' || user?.is_tutor || isTutorUser) && (
              <>
                <div className="p-2 text-base [&>*]:cursor-pointer">
                  <Link
                    href={"/calendar"}
                    onClick={() => setIsOpen(false)}
                    className={getItemClass("/calendar")}
                  >
                    <CalendarIcon width={20} height={20} />
                    <span className="mr-auto text-base font-medium">Theo dõi lịch dạy</span>
                  </Link>

                  <Link
                    href={"/payments"}
                    onClick={() => setIsOpen(false)}
                    className={getItemClass("/payments")}
                  >
                    <BanknotesIcon width={20} height={20} />
                    <span className="mr-auto text-base font-medium">Học phí & Thanh toán</span>
                  </Link>
                </div>
                <hr className="border-[#E8E8E8] dark:border-dark-3" />
              </>
            )}

            {/* Student Menu */}
            {user?.role === 'student' && (
              <>
                <div className="p-2 text-base [&>*]:cursor-pointer">
                  <Link
                    href={"/classes"}
                    onClick={() => setIsOpen(false)}
                    className={getItemClass("/classes")}
                  >
                    <AcademicCapIcon width={20} height={20} />
                    <span className="mr-auto text-base font-medium">Lớp của tôi</span>
                  </Link>

                  <Link
                    href={"/assignments"}
                    onClick={() => setIsOpen(false)}
                    className={getItemClass("/assignments")}
                  >
                    <ClipboardDocumentListIcon width={20} height={20} />
                    <span className="mr-auto text-base font-medium">Bài tập</span>
                  </Link>

                  <Link
                    href={"/calendar"}
                    onClick={() => setIsOpen(false)}
                    className={getItemClass("/calendar")}
                  >
                    <CalendarIcon width={20} height={20} />
                    <span className="mr-auto text-base font-medium">Theo dõi lịch học</span>
                  </Link>

                  <Link
                    href={"/my-reports"}
                    onClick={() => setIsOpen(false)}
                    className={getItemClass("/my-reports")}
                  >
                    <ChartBarIcon width={20} height={20} />
                    <span className="mr-auto text-base font-medium">Tiến độ học tập</span>
                  </Link>
                </div>
                <hr className="border-[#E8E8E8] dark:border-dark-3" />
              </>
            )}

            <div className="p-2 text-base [&>*]:cursor-pointer">
              <Link
                href={"/profile"}
                onClick={() => setIsOpen(false)}
                className={getItemClass("/profile")}
              >
                <UserIcon />

                <span className="mr-auto text-base font-medium">Xem hồ sơ</span>
              </Link>

              <Link
                href={"/settings/profile"}
                onClick={() => setIsOpen(false)}
                className={getItemClass("/settings/profile")}
              >
                <SettingsIcon />

                <span className="mr-auto text-base font-medium">
                  Cài đặt tài khoản
                </span>
              </Link>
            </div>

            <hr className="border-[#E8E8E8] dark:border-dark-3" />

            <div className="p-2 text-base text-[#4B5563] dark:text-dark-6">
              <button
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[9px] text-red-500 hover:bg-red-50 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
                onClick={handleLogout}
              >
                <LogOutIcon />

                <span className="text-base font-medium">Đăng xuất</span>
              </button>
            </div>
          </div>
        </div>
      </DropdownContent>
    </Dropdown>
  );
}
