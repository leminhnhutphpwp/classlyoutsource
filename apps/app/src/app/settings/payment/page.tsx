"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/contexts/auth-context";
import { useOrganizationContext } from "@/contexts/organization-context";

/**
 * Trang cài đặt thanh toán CŨ (tài khoản ngân hàng cá nhân của tutor).
 * Từ mô hình mới, học phí chuyển vào tài khoản của TRUNG TÂM — trang này chỉ
 * còn là redirect: owner/manager → trang quản lý tài khoản ngân hàng của tổ chức,
 * các vai trò khác → dashboard.
 */
export default function PaymentSettingsPage() {
  const { isAuthenticated, loading } = useAuthContext();
  const { canManageOrg, loading: orgLoading } = useOrganizationContext();
  const router = useRouter();

  useEffect(() => {
    if (loading || orgLoading) return;
    if (!isAuthenticated) {
      router.replace("/auth/sign-in");
      return;
    }

    if (canManageOrg) {
      router.replace("/settings/organization/bank-accounts");
    } else {
      // Tutor/student/parent không quản lý tài khoản ngân hàng của trung tâm
      router.replace("/dashboard");
    }
  }, [loading, orgLoading, isAuthenticated, canManageOrg, router]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
    </div>
  );
}