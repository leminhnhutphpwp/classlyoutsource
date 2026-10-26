"use client";

import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import ButtonLink from "@/components/Common/ButtonLink";
import { useAuthContext } from "@/contexts/auth-context";
import { useOrganizationContext } from "@/contexts/organization-context";
import { isTutor } from "@/lib/permissions-utils";
import { MembersRoster } from "../_components/members-roster";
import { AddTutorForm } from "../_components/add-tutor-form";
import { AssignClassForm } from "../_components/assign-class-form";
import { OrgLoadingSkeleton } from "../_components/org-states";

export default function OrganizationMembersPage() {
  const { user } = useAuthContext();
  const { loading, hasOrg, organization, canManageOrg } = useOrganizationContext();

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

  // Chưa thuộc trung tâm → hướng người dùng về trang tổng quan để tạo trung tâm.
  if (!hasOrg || !organization) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <Header />
        <div className="rounded-lg bg-white p-6 text-sm text-dark-4 dark:bg-gray-800 dark:text-dark-6">
          Bạn chưa có trung tâm. Hãy tạo trung tâm ở trang{" "}
          <a href="/organization" className="font-medium text-primary hover:underline">
            Tổng quan trung tâm
          </a>{" "}
          trước khi thêm gia sư.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <Header />

      {/* Công cụ quản trị (owner/manager) */}
      {canManageOrg && (
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
          <AddTutorForm orgHash={organization.id} />
          <AssignClassForm orgHash={organization.id} />
        </div>
      )}

      <MembersRoster orgHash={organization.id} />
    </div>
  );
}

function Header() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
      <ButtonLink
        href="/organization"
        variant="outline"
        size="sm"
        icon={<ArrowLeftIcon />}
        className="w-full justify-center sm:w-auto"
        lockAware={false}
      >
        Quay lại
      </ButtonLink>
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-bold text-dark dark:text-white sm:text-2xl">
          Thành viên trung tâm
        </h1>
        <p className="mt-1 text-dark-4 dark:text-dark-6">
          Thêm gia sư, phân công lớp học và quản lý đội ngũ
        </p>
      </div>
    </div>
  );
}
