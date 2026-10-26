"use client";
import type { PropsWithChildren } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import ProtectedRoute from "@/components/Auth/ProtectedRoute";
import { useAuthContext } from "@/contexts/auth-context";
import { getLandingPath } from "@/lib/landing-path";
import { useChild } from "@/hooks/use-api/family";
import { formatCurrency } from "@/lib/format-currency";
import {
  ArrowLeftIcon,
  CalendarIcon,
  ClipboardDocumentCheckIcon,
  AcademicCapIcon,
  DocumentTextIcon,
  BanknotesIcon,
} from "@heroicons/react/24/outline";

const TABS = [
  { key: "schedule", label: "Lịch học", icon: CalendarIcon },
  { key: "attendance", label: "Điểm danh", icon: ClipboardDocumentCheckIcon },
  { key: "grades", label: "Điểm số", icon: AcademicCapIcon },
  { key: "assignments", label: "Bài tập", icon: DocumentTextIcon },
  { key: "tuition", label: "Học phí", icon: BanknotesIcon },
];

export default function ChildLayout({ children }: PropsWithChildren) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const studentId = params?.studentId as string;

  const { user, loading: authLoading } = useAuthContext();
  const isParent = user?.role === "parent";

  useEffect(() => {
    if (!authLoading && user && !isParent) {
      router.replace(getLandingPath(user));
    }
  }, [authLoading, user, isParent, router]);

  const { child } = useChild(studentId);
  const activeTab = TABS.find((t) => pathname?.endsWith(`/${t.key}`))?.key ?? "schedule";

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/family"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700/50"
              aria-label="Quay lại danh sách học viên"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold text-gray-900 dark:text-white">
                {child?.name || "Học viên"}
              </h1>
              {child?.tutor_name && (
                <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                  Giáo viên: {child.tutor_name}
                </p>
              )}
            </div>
          </div>
          {child && (child.outstanding_tuition ?? 0) > 0 && (
            <div className="rounded-xl bg-red-50 px-4 py-2 text-sm dark:bg-red-500/10">
              <span className="text-gray-500 dark:text-gray-400">Học phí còn nợ: </span>
              <span className="font-bold text-red-600 dark:text-red-400">
                {formatCurrency(child.outstanding_tuition ?? 0)}
              </span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto border-b border-gray-200 pb-px dark:border-gray-700">
          {TABS.map((tab) => {
            const isActive = tab.key === activeTab;
            return (
              <Link
                key={tab.key}
                href={`/family/${studentId}/${tab.key}`}
                className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </Link>
            );
          })}
        </div>

        {children}
      </div>
    </ProtectedRoute>
  );
}
