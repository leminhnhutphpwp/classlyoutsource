"use client";

import { cn } from "@/lib/utils";
import type { OrgRole, OrgMemberStatus } from "@/types/organization";

export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Chủ trung tâm",
  manager: "Quản lý",
  accountant: "Kế toán",
  tutor: "Giáo viên",
};

export const ORG_STATUS_LABELS: Record<OrgMemberStatus, string> = {
  active: "Đang hoạt động",
  invited: "Đang chờ",
  removed: "Đã gỡ",
};

export function RoleBadge({ role, className }: { role: OrgRole; className?: string }) {
  const styles: Record<OrgRole, string> = {
    owner:
      "bg-primary-pastel/50 text-primary dark:bg-primary/20 dark:text-primary-light",
    manager:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    accountant:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    tutor:
      "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles[role],
        className
      )}
    >
      {ORG_ROLE_LABELS[role] ?? role}
    </span>
  );
}

/**
 * Trạng thái kích hoạt của gia sư do trung tâm tạo:
 * - `activated=false` → gia sư chưa đặt mật khẩu / xác thực email (chưa đăng nhập được).
 * - `activated=true`  → đã kích hoạt, đăng nhập được (badge tinh tế).
 */
export function ActivationBadge({
  activated,
  className,
}: {
  activated: boolean;
  className?: string;
}) {
  if (!activated) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-800/60 dark:bg-amber-900/30 dark:text-amber-300",
          className
        )}
        title="Gia sư chưa đặt mật khẩu — chưa thể đăng nhập"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Chưa kích hoạt
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400",
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
      Đã kích hoạt
    </span>
  );
}

export function StatusBadge({ status, className }: { status: OrgMemberStatus; className?: string }) {
  const styles: Record<OrgMemberStatus, string> = {
    active:
      "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    invited:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    removed:
      "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles[status],
        className
      )}
    >
      {ORG_STATUS_LABELS[status] ?? status}
    </span>
  );
}
