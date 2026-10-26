"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/Auth/ProtectedRoute";
import { useAuthContext } from "@/contexts/auth-context";
import { getLandingPath } from "@/lib/landing-path";
import { useChildren, type Child } from "@/hooks/use-api/family";
import { formatCurrency } from "@/lib/format-currency";
import {
  UserGroupIcon,
  AcademicCapIcon,
  BanknotesIcon,
  ArrowRightIcon,
  CalendarIcon,
  ClipboardDocumentCheckIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";

function ChildAvatar({ child }: { child: Child }) {
  if (child.avatar) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={child.avatar}
        alt={child.name}
        className="h-12 w-12 flex-shrink-0 rounded-full object-cover"
      />
    );
  }
  const initial = (child.name || "?").trim().charAt(0).toUpperCase();
  return (
    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary-pastel/60 text-lg font-semibold text-primary">
      {initial}
    </div>
  );
}

function ChildCard({ child }: { child: Child }) {
  const hasOutstanding = (child.outstanding_tuition ?? 0) > 0;

  const quickLinks = [
    { label: "Lịch học", href: `/family/${child.id}/schedule`, icon: CalendarIcon },
    { label: "Điểm danh", href: `/family/${child.id}/attendance`, icon: ClipboardDocumentCheckIcon },
    { label: "Điểm số", href: `/family/${child.id}/grades`, icon: AcademicCapIcon },
    { label: "Bài tập", href: `/family/${child.id}/assignments`, icon: DocumentTextIcon },
  ];

  return (
    <div className="flex flex-col rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
      <div className="flex items-start gap-4">
        <ChildAvatar child={child} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold text-gray-900 dark:text-white">{child.name}</h3>
          {child.tutor_name && (
            <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">
              Giáo viên: {child.tutor_name}
            </p>
          )}
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
            {child.class_count ?? 0} lớp đang tham gia
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-gray-50 p-4 dark:bg-gray-900/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <BanknotesIcon className="h-5 w-5" />
            Học phí còn nợ
          </div>
          <span
            className={`text-base font-bold ${
              hasOutstanding ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
            }`}
          >
            {formatCurrency(child.outstanding_tuition ?? 0)}
          </span>
        </div>
        <Link
          href={`/family/${child.id}/tuition`}
          className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
            hasOutstanding
              ? "bg-primary text-white hover:bg-opacity-90"
              : "border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700/50"
          }`}
        >
          {hasOutstanding ? "Thanh toán học phí" : "Xem học phí"}
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 text-sm text-gray-700 transition hover:border-primary/40 hover:bg-primary-pastel/20 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700/40"
          >
            <link.icon className="h-4 w-4 text-primary" />
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function FamilyPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthContext();
  const isParent = user?.role === "parent";

  // Không phải phụ huynh → đưa về đúng trang chủ theo vai trò
  useEffect(() => {
    if (!authLoading && user && !isParent) {
      router.replace(getLandingPath(user));
    }
  }, [authLoading, user, isParent, router]);

  const { children, loading, error, refetch } = useChildren();

  const showSkeleton = authLoading || (isParent && loading);

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Con của tôi</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Theo dõi lịch học, điểm danh, kết quả học tập và học phí của con.
          </p>
        </div>

        {showSkeleton ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl bg-white dark:bg-gray-800" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-white p-8 text-center dark:bg-gray-800">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Không thể tải danh sách</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{error}</p>
            <button
              onClick={() => refetch()}
              className="mt-4 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-opacity-90"
            >
              Thử lại
            </button>
          </div>
        ) : children.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center dark:bg-gray-800">
            <UserGroupIcon className="mx-auto h-14 w-14 text-gray-300 dark:text-gray-600" />
            <p className="mt-4 text-sm font-semibold text-gray-900 dark:text-white">Chưa có học viên nào</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Khi giáo viên liên kết học viên với tài khoản của bạn, thông tin sẽ hiển thị tại đây.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {children.map((child) => (
              <ChildCard key={child.id} child={child} />
            ))}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
