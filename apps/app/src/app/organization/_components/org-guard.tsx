"use client";

import type { ReactNode } from "react";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import ButtonLink from "@/components/Common/ButtonLink";
import { useAuthContext } from "@/contexts/auth-context";
import { useOrganizationContext } from "@/contexts/organization-context";
import { isTutor } from "@/lib/permissions-utils";
import { OrgLoadingSkeleton } from "./org-states";

function Notice({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-lg bg-white p-8 text-center dark:bg-gray-800">
      <h2 className="text-lg font-semibold text-dark dark:text-white">{title}</h2>
      <p className="mt-2 text-sm text-dark-4 dark:text-dark-6">{message}</p>
      <div className="mt-6 flex justify-center">
        <ButtonLink href="/organization" variant="outline" icon={<ArrowLeftIcon />} lockAware={false}>
          Về tổng quan trung tâm
        </ButtonLink>
      </div>
    </div>
  );
}

/**
 * Bọc các trang tính năng trung tâm (tài chính / bảng lương): xử lý các trạng thái
 * chung (không phải giáo viên, đang tải, chưa có trung tâm, không đủ quyền).
 * `allowed` = kết quả kiểm tra quyền từ organization-context.
 */
export function OrgFeatureGuard({
  allowed,
  children,
}: {
  allowed: boolean;
  children: ReactNode;
}) {
  const { user } = useAuthContext();
  const { loading, hasOrg } = useOrganizationContext();

  if (user && !isTutor(user)) {
    return (
      <Notice
        title="Tính năng không khả dụng"
        message="Quản lý trung tâm chỉ dành cho tài khoản giáo viên."
      />
    );
  }

  if (loading) return <OrgLoadingSkeleton />;

  if (!hasOrg) {
    return (
      <Notice
        title="Chưa có trung tâm"
        message="Bạn chưa thuộc trung tâm nào. Hãy tạo trung tâm ở trang tổng quan trước."
      />
    );
  }

  if (!allowed) {
    return (
      <Notice
        title="Bạn không có quyền truy cập"
        message="Chỉ chủ trung tâm, quản lý hoặc kế toán mới xem được nội dung này."
      />
    );
  }

  return <>{children}</>;
}
