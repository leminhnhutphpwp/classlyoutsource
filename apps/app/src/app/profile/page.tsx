"use client";
import { roleLabel } from "@/lib/role-label";
import { useAuthContext } from "@/contexts/auth-context";
import Image from "next/image";
import {
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  BriefcaseIcon,
  CalendarIcon,
  ArrowLeftIcon
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { useErrorDisplay } from "@/components/Common/ErrorDisplay";

import { useLockContext } from "@/contexts/lock-context";
import { useGoBack } from "@/hooks/use-go-back";
import Button from "@/components/Common/Button";
export default function ProfilePage() {
  const { user, loading } = useAuthContext();
  const { actionsLocked, planFeatureMessage } = useLockContext();
  const handleGoBack = useGoBack('/dashboard');
  const { renderError } = useErrorDisplay("Hồ sơ cá nhân");

  // Kiểm tra lock và plan feature trước để ưu tiên hiển thị lock content
  if (actionsLocked || planFeatureMessage) {
    return renderError();
  }

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="h-10 w-full sm:w-24 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="flex-1 min-w-0">
            <div className="h-7 sm:h-8 w-full sm:w-64 rounded bg-gray-200 dark:bg-gray-700 animate-pulse mb-2" />
            <div className="h-4 w-full sm:w-48 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
          </div>
        </div>

        {/* Profile Skeleton */}
        <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
          <div className="flex flex-col md:flex-row gap-4 sm:gap-6">
            <div className="flex-shrink-0 flex justify-center md:justify-start">
              <div className="h-24 w-24 sm:h-32 sm:w-32 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="flex-1 space-y-4">
              <div className="h-6 w-full sm:w-48 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="space-y-2">
                <div className="h-4 w-20 sm:w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-4 w-full sm:w-64 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-20 sm:w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-4 w-full sm:w-64 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return renderError("Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại", () => window.location.reload());
  }

  const userName = user.name || user.email?.split('@')[0] || 'Người dùng';
  const userAvatar = user?.avatar || '/images/user/default-avatar.png';

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <Button
          onClick={handleGoBack}
          variant="outline"
          size="sm"
          icon={<ArrowLeftIcon />}
          className="w-full sm:w-auto justify-center"
        >
          Quay lại
        </Button>

        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white">Hồ sơ cá nhân</h1>
          <p className="text-sm sm:text-base text-dark-4 dark:text-dark-6 mt-1">
            Xem và quản lý thông tin tài khoản của bạn
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
            <div className="flex flex-col items-center text-center">
              <div className="mb-3 sm:mb-4">
                <div className="relative size-24 sm:size-32 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  {userAvatar ? (
                    <Image
                      src={userAvatar}
                      className="size-24 sm:size-32 object-cover"
                      alt={`Avatar of ${userName}`}
                      width={128}
                      height={128}
                      onError={(e) => {
                        e.currentTarget.src = '/images/user/default-avatar.png';
                      }}
                    />
                  ) : (
                    <div className="flex size-24 sm:size-32 items-center justify-center text-3xl sm:text-4xl font-semibold text-gray-600 dark:text-gray-300">
                      {userName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>

              <h2 className="text-lg sm:text-xl font-bold text-dark dark:text-white mb-1 break-words">
                {userName}
              </h2>

              {user.role && (
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${user.role === "super_admin" || user.role === "admin"
                      ? "bg-primary-100 text-primary-800 dark:bg-primary-900/20 dark:text-primary-400"
                      : user.role === "tutor"
                        ? "bg-primary-pastel/40 text-primary"
                        : "bg-primary-pastel text-primary"
                    }`}
                >
                  {roleLabel(user as any)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="lg:col-span-2">
          <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4 sm:mb-6">
              Thông tin chi tiết
            </h3>

            <div className="space-y-4 sm:space-y-6">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Họ và tên
                </label>
                <div className="flex items-start gap-2 sm:gap-3">
                  <UserIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm sm:text-base text-gray-900 dark:text-white break-words">{user.name || 'Chưa có'}</p>
                </div>
              </div>

              {user.email && (
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Email
                  </label>
                  <div className="flex items-start gap-2 sm:gap-3">
                    <EnvelopeIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white break-all">{user.email}</p>
                  </div>
                </div>
              )}

              {user.phone && (
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Số điện thoại
                  </label>
                  <div className="flex items-start gap-2 sm:gap-3">
                    <PhoneIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white break-words">{user.phone}</p>
                  </div>
                </div>
              )}

              {user.address && (
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Địa chỉ
                  </label>
                  <div className="flex items-start gap-2 sm:gap-3">
                    <MapPinIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white break-words">{user.address}</p>
                  </div>
                </div>
              )}

              {user.bio && (
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Giới thiệu
                  </label>
                  <p className="text-sm sm:text-base text-gray-900 dark:text-white whitespace-pre-wrap break-words">{user.bio}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                {user.role && (
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                      Vai trò
                    </label>
                    <div className="flex items-start gap-2 sm:gap-3">
                      <BriefcaseIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm sm:text-base text-gray-900 dark:text-white break-words">
                        {roleLabel(user as any)}
                      </p>
                    </div>
                  </div>
                )}

                {user.created_at && (
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                      Ngày tham gia
                    </label>
                    <div className="flex items-start gap-2 sm:gap-3">
                      <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm sm:text-base text-gray-900 dark:text-white break-words">
                        {new Date(user.created_at).toLocaleDateString('vi-VN', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Button */}
      <div className="flex justify-center sm:justify-end">
        <Link
          href="/settings"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm sm:text-base font-medium text-white transition-colors hover:bg-primary/90 w-full sm:w-auto"
        >
          Chỉnh sửa hồ sơ
        </Link>
      </div>
    </div>
  );
}

