"use client";

import { useState } from "react";
import {
  TrashIcon,
  PencilSquareIcon,
  ArrowUturnLeftIcon,
} from "@heroicons/react/24/outline";
import Button from "@/components/Common/Button";
import ConfirmDeleteDialog from "@/components/Common/ConfirmDeleteDialog";
import {
  useRemoveOrgMember,
  useRestoreOrgMember,
  useUpdateOrgMemberRole,
} from "@/hooks/use-api";
import { useOrganizationContext } from "@/contexts/organization-context";
import { useNotification } from "@/hooks/use-notification";
import { extractErrorMessage } from "@/lib/api-error-utils";
import { ActivationBadge, RoleBadge, StatusBadge } from "./org-ui";
import { RoleChangeDialog } from "./role-change-dialog";
import { RemoveMemberDialog } from "./remove-member-dialog";
import type { OrgMember, OrgRole } from "@/types/organization";

/**
 * Ai được gỡ ai:
 * - owner: gỡ mọi người trừ owner khác.
 * - manager: chỉ gỡ giáo viên (tutor).
 * Không thể tự gỡ chính mình. Chỉ gỡ được thành viên đang active/invited.
 */
function canRemoveMember(
  member: OrgMember,
  myRole: OrgRole | null,
  myMemberId: string | null
): boolean {
  if (member.status === "removed") return false;
  if (myMemberId && member.id === myMemberId) return false;

  if (myRole === "owner") {
    return member.org_role !== "owner";
  }
  if (myRole === "manager") {
    return member.org_role === "tutor";
  }
  return false;
}

export function MembersRoster({ orgHash }: { orgHash: string }) {
  const { members, myRole, myMembership, canManageRoles, refetch } =
    useOrganizationContext();
  const { mutate: removeMember, loading: removing } = useRemoveOrgMember();
  const { mutate: restoreMember, loading: restoring } = useRestoreOrgMember();
  const { mutate: updateRole, loading: updatingRole } = useUpdateOrgMemberRole();
  const { success, error: showError } = useNotification();

  const [removeTarget, setRemoveTarget] = useState<OrgMember | null>(null);
  const [roleTarget, setRoleTarget] = useState<OrgMember | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<OrgMember | null>(null);
  const myMemberId = myMembership?.id ?? null;

  const handleRemove = async () => {
    if (!removeTarget) return;
    const res = await removeMember(orgHash, removeTarget.id);
    if (res.success) {
      success(
        "Đã gỡ thành viên",
        `${removeTarget.name} đã được tạm ngưng đăng nhập và có thể khôi phục khi tuyển lại.`
      );
      setRemoveTarget(null);
      refetch();
    } else {
      showError(extractErrorMessage(res, "Không thể gỡ thành viên. Vui lòng thử lại."));
    }
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    const res = await restoreMember(orgHash, restoreTarget.id);
    if (res.success) {
      success("Đã khôi phục thành viên", `${restoreTarget.name} đã trở lại trung tâm.`);
      setRestoreTarget(null);
      refetch();
    } else {
      showError(extractErrorMessage(res, "Không thể khôi phục thành viên."));
    }
  };

  const handleRoleChange = async (
    newRole: Extract<OrgRole, "tutor" | "manager" | "accountant">
  ) => {
    if (!roleTarget) return;
    const res = await updateRole(orgHash, roleTarget.id, newRole);
    if (res.success) {
      success("Đã đổi vai trò", `${roleTarget.name} giờ là ${roleLabel(newRole)}.`);
      setRoleTarget(null);
      refetch();
    } else {
      showError(extractErrorMessage(res, "Không thể đổi vai trò. Vui lòng thử lại."));
    }
  };

  // Sắp xếp: gia sư chưa kích hoạt lên trước, đã gỡ xuống cuối.
  const sorted = [...members].sort((a, b) => {
    const rank = (m: OrgMember) =>
      m.status === "removed" ? 2 : m.activated ? 1 : 0;
    return rank(a) - rank(b);
  });

  // owner có thể đổi vai trò cho manager/accountant/tutor (không đổi owner).
  const canChangeRoleOf = (m: OrgMember) =>
    canManageRoles && m.status !== "removed" && m.org_role !== "owner" && m.id !== myMemberId;

  return (
    <div className="rounded-lg bg-white dark:bg-gray-800">
      <RemoveMemberDialog
        open={!!removeTarget}
        member={removeTarget}
        loading={removing}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemove}
      />

      <RoleChangeDialog
        open={!!roleTarget}
        member={roleTarget}
        loading={updatingRole}
        onClose={() => setRoleTarget(null)}
        onConfirm={handleRoleChange}
      />

      <ConfirmDeleteDialog
        open={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onConfirm={handleRestore}
        loading={restoring}
        label="Khôi phục thành viên"
        message={
          restoreTarget
            ? `Khôi phục ${restoreTarget.name} trở lại trung tâm?`
            : ""
        }
      />

      <div className="border-b border-gray-200 px-4 py-4 dark:border-gray-700 sm:px-6">
        <h3 className="text-base font-semibold text-dark dark:text-white sm:text-lg">
          Danh sách thành viên
        </h3>
        <p className="mt-1 text-sm text-dark-4 dark:text-dark-6">
          {members.length} thành viên trong trung tâm
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
          Chưa có thành viên nào. Hãy thêm gia sư đầu tiên của bạn.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-gray-2 text-xs uppercase text-gray-500 dark:bg-dark-2 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3 sm:px-6">Thành viên</th>
                <th className="px-4 py-3">Vai trò</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3 text-right sm:px-6">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sorted.map((m) => {
                const removable = canRemoveMember(m, myRole, myMemberId);
                const changeable = canChangeRoleOf(m);
                const isRemoved = m.status === "removed";
                const restorable = canManageRoles && isRemoved;
                const isSelf = myMemberId && m.id === myMemberId;
                return (
                  <tr key={m.id} className="text-gray-900 dark:text-gray-200">
                    <td className="px-4 py-3 sm:px-6">
                      <div className="flex flex-wrap items-center gap-2 font-medium">
                        {m.name}
                        {isSelf && <span className="text-xs text-gray-400">(Bạn)</span>}
                        {!isRemoved && <ActivationBadge activated={m.activated} />}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {m.email}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <RoleBadge role={m.org_role} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={m.status} />
                    </td>
                    <td className="px-4 py-3 text-right sm:px-6">
                      <div className="flex flex-wrap justify-end gap-2">
                        {changeable && (
                          <Button
                            variant="outline"
                            size="sm"
                            icon={<PencilSquareIcon />}
                            onClick={() => setRoleTarget(m)}
                            aria-label={`Đổi vai trò ${m.name}`}
                          >
                            Vai trò
                          </Button>
                        )}
                        {removable && (
                          <Button
                            variant="danger"
                            size="sm"
                            icon={<TrashIcon />}
                            onClick={() => setRemoveTarget(m)}
                            aria-label={`Gỡ ${m.name}`}
                          >
                            Gỡ
                          </Button>
                        )}
                        {restorable && (
                          <Button
                            variant="outline"
                            size="sm"
                            icon={<ArrowUturnLeftIcon />}
                            onClick={() => setRestoreTarget(m)}
                            aria-label={`Khôi phục ${m.name}`}
                          >
                            Khôi phục
                          </Button>
                        )}
                        {!changeable && !removable && !restorable && (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function roleLabel(role: OrgRole): string {
  const labels: Record<OrgRole, string> = {
    owner: "Chủ trung tâm",
    manager: "Quản lý",
    accountant: "Kế toán",
    tutor: "Giáo viên",
  };
  return labels[role] ?? role;
}
