"use client";

import {
  UsersIcon,
  BanknotesIcon,
  CurrencyDollarIcon,
} from "@heroicons/react/24/outline";
import ButtonLink from "@/components/Common/ButtonLink";
import { useAuthContext } from "@/contexts/auth-context";
import { useOrganizationContext } from "@/contexts/organization-context";
import { isTutor } from "@/lib/permissions-utils";
import { CreateOrganizationForm } from "./_components/create-organization-form";
import { OrganizationDashboard } from "./_components/organization-dashboard";
import { EditOrganizationForm } from "./_components/edit-organization-form";
import { OrgLoadingSkeleton } from "./_components/org-states";
import { RoleBadge } from "./_components/org-ui";
import { AiUsageCard } from "./_components/ai-usage-card";

export default function OrganizationPage() {
  const { user } = useAuthContext();
  const {
    loading,
    hasOrg,
    organization,
    myRole,
    canManageOrg,
    canViewFinance,
    canManagePayroll,
    isMemberTutor,
  } = useOrganizationContext();

  // Chỉ giáo viên mới dùng tính năng trung tâm.
  if (user && !isTutor(user)) {
    return (
      <div className="rounded-lg bg-white p-8 text-center dark:bg-gray-800">
        <h2 className="text-lg font-semibold text-dark dark:text-white">
          Tính năng không khả dụng
        </h2>
        <p className="mt-2 text-sm text-dark-4 dark:text-dark-6">
          Quản lý trung tâm chỉ dành cho tài khoản giáo viên.
        </p>
      </div>
    );
  }

  if (loading) {
    return <OrgLoadingSkeleton />;
  }

  // Chưa thuộc trung tâm nào.
  if (!hasOrg) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <PageHeader />
        <CreateOrganizationForm />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold text-dark dark:text-white sm:text-2xl">
              {organization?.name}
            </h1>
            {myRole && <RoleBadge role={myRole} />}
          </div>
          {organization?.description && (
            <p className="mt-1 break-words text-dark-4 dark:text-dark-6">
              {organization.description}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 sm:shrink-0">
          {canViewFinance && (
            <ButtonLink
              href="/organization/finance"
              variant="outline"
              icon={<BanknotesIcon />}
              lockAware={false}
            >
              Tài chính
            </ButtonLink>
          )}
          {canManagePayroll && (
            <ButtonLink
              href="/organization/payroll"
              variant="outline"
              icon={<CurrencyDollarIcon />}
              lockAware={false}
            >
              Bảng lương
            </ButtonLink>
          )}
          {isMemberTutor && (
            <ButtonLink
              href="/organization/my-payslips"
              variant="outline"
              icon={<CurrencyDollarIcon />}
              lockAware={false}
            >
              Bảng lương của tôi
            </ButtonLink>
          )}
          {canManageOrg && (
            <ButtonLink
              href="/organization/members"
              variant="outline"
              icon={<UsersIcon />}
              lockAware={false}
            >
              Quản lý thành viên
            </ButtonLink>
          )}
        </div>
      </div>

      {/* Dashboard aggregate + per-tutor breakdown (owner/manager only — the org
          dashboard endpoint is owner/manager-gated; an accountant reads their numbers
          via the Finance reports instead). */}
      {canManageOrg && organization && (
        <OrganizationDashboard orgHash={organization.id} />
      )}

      {/* Kế toán: không có dashboard tổng hợp — chỉ dẫn sang Tài chính. */}
      {!canManageOrg && canViewFinance && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-dark-4 dark:border-gray-700 dark:bg-gray-800 dark:text-dark-6">
          Với vai trò kế toán, số liệu doanh thu, chi phí, công nợ và lợi nhuận của trung tâm
          nằm ở mục <span className="font-semibold text-dark dark:text-white">Tài chính</span>.
        </div>
      )}

      {/* Hạn mức AI của trung tâm (owner/manager) */}
      {canManageOrg && organization && <AiUsageCard orgHash={organization.id} />}

      {/* Chỉnh sửa thông tin trung tâm (owner/manager) */}
      {canManageOrg && organization && (
        <EditOrganizationForm organization={organization} />
      )}
    </div>
  );
}

function PageHeader() {
  return (
    <div>
      <h1 className="text-xl font-bold text-dark dark:text-white sm:text-2xl">
        Trung tâm
      </h1>
      <p className="mt-1 text-dark-4 dark:text-dark-6">
        Quản lý trung tâm, đội ngũ giáo viên và lớp học của bạn
      </p>
    </div>
  );
}
