'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { useCurrentOrganization } from '@/hooks/use-api';
import { useAuthContext } from '@/contexts/auth-context';
import { isTutor } from '@/lib/permissions-utils';
import type { CurrentOrganization, OrgMember, OrgRole } from '@/types/organization';

interface OrganizationContextType {
  loading: boolean;
  /** Người dùng đã thuộc một trung tâm. */
  hasOrg: boolean;
  organization: CurrentOrganization['organization'] | null;
  members: OrgMember[];
  myRole: OrgRole | null;
  /** Bản ghi thành viên của chính người dùng hiện tại (nếu có). */
  myMembership: OrgMember | null;
  /** Có nên hiển thị mục "Trung tâm" trên thanh điều hướng. */
  canSeeOrgNav: boolean;
  /** owner/manager được phép quản trị (tạo/gỡ thành viên, phân công lớp...). */
  canManageOrg: boolean;
  // ---- Wave 5: tài chính / bảng lương / phân quyền ----
  /** Xem báo cáo tài chính (P&L, dòng tiền, công nợ...). owner/manager/accountant. */
  canViewFinance: boolean;
  /** Quản lý bảng lương (hồ sơ lương, tính, duyệt). owner/manager. */
  canManagePayroll: boolean;
  /** Xem (chỉ đọc) kỳ lương & phiếu lương. owner/manager/accountant. */
  canReadPayroll: boolean;
  /** Đánh dấu ĐÃ TRẢ lương — chỉ chủ trung tâm. */
  canMarkPayrollPaid: boolean;
  /** Đổi vai trò / khôi phục thành viên — chỉ chủ trung tâm. */
  canManageRoles: boolean;
  /**
   * Là giáo viên thành viên bình thường (không phải owner/manager/accountant).
   * Chỉ thấy "Bảng lương của tôi".
   */
  isMemberTutor: boolean;
  refetch: () => void;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthContext();

  // Chỉ giáo viên mới có thể thuộc/tạo trung tâm → tránh gọi API thừa cho
  // học viên/phụ huynh.
  const isUserTutor = isTutor(user);

  const { data, loading, refetch } = useCurrentOrganization(isUserTutor);

  const value = useMemo<OrganizationContextType>(() => {
    const current = data ?? null;
    const hasOrg = !!current?.organization;
    const members = current?.members ?? [];
    const myRole = current?.my_role ?? null;

    // Xác định bản ghi của chính mình theo email (id thành viên là hashid riêng).
    const myEmail = user?.email?.toLowerCase();
    const myMembership =
      (myEmail && members.find((m) => m.email?.toLowerCase() === myEmail)) || null;

    const canManageOrg = myRole === 'owner' || myRole === 'manager';
    // Tính năng Trung tâm luôn khả dụng với giáo viên; chỉ hiện nav khi đã thuộc trung tâm.
    const canSeeOrgNav = hasOrg;

    // Wave 5 visibility gating (chỉ áp dụng khi đã thuộc trung tâm).
    const canViewFinance =
      hasOrg && (myRole === 'owner' || myRole === 'manager' || myRole === 'accountant');
    const canManagePayroll = hasOrg && (myRole === 'owner' || myRole === 'manager');
    const canReadPayroll = canViewFinance; // owner/manager/accountant
    const canMarkPayrollPaid = hasOrg && myRole === 'owner';
    const canManageRoles = hasOrg && myRole === 'owner';
    const isMemberTutor = hasOrg && myRole === 'tutor';

    return {
      loading: isUserTutor ? loading : false,
      hasOrg,
      organization: current?.organization ?? null,
      members,
      myRole,
      myMembership,
      canSeeOrgNav,
      canManageOrg,
      canViewFinance,
      canManagePayroll,
      canReadPayroll,
      canMarkPayrollPaid,
      canManageRoles,
      isMemberTutor,
      refetch,
    };
  }, [data, loading, refetch, user, isUserTutor]);

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganizationContext() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganizationContext must be used within an OrganizationProvider');
  }
  return context;
}