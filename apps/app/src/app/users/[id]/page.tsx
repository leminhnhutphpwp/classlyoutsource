"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser, useDeleteUser, useResetUserPassword, useActivateUser, useDeactivateUser } from "@/hooks/use-api";
import { useGoBack } from "@/hooks/use-go-back";
import {
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  KeyIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";
import ConfirmDeleteDialog from '@/components/Common/ConfirmDeleteDialog';
import { useNotification } from "@/hooks/use-notification";
import { useAuthorization } from "@/lib/authz";
import Button from "@/components/Common/Button";
import ButtonLink from "@/components/Common/ButtonLink";
import { Tabs, TabPanel } from "@/components/Common/Tabs";
import ErrorDisplay from "@/components/Common/ErrorDisplay";

export default function UserDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;
  const { can } = useAuthorization();
  const { success, error: showError } = useNotification();
  const handleGoBack = useGoBack('/users');
  const [activeTab, setActiveTab] = useState("overview");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { data: user, loading: userLoading, error: userError, refetch } = useUser(userId);
  const { mutate: deleteUser, loading: deleting } = useDeleteUser();
  const { mutate: resetPassword, loading: resettingPassword } = useResetUserPassword();
  const { mutate: activateUser, loading: activating } = useActivateUser();
  const { mutate: deactivateUser, loading: deactivating } = useDeactivateUser();

  if (userLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-10 w-24 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="flex-1">
            <div className="h-8 w-64 rounded bg-gray-200 dark:bg-gray-700 animate-pulse mb-2" />
            <div className="h-4 w-48 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
          </div>
        </div>
        <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (userError && !userLoading) {
    return <ErrorDisplay error={userError} title="Lỗi tải dữ liệu người dùng" onRetry={() => refetch()} />;
  }

  const handleDelete = async () => {
    const result = await deleteUser(userId);
    if (result.success) {
      success("Đã xóa người dùng thành công!");
      router.push("/users");
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      showError("Vui lòng nhập mật khẩu mới");
      return;
    }
    if (newPassword !== confirmPassword) {
      showError("Mật khẩu xác nhận không khớp");
      return;
    }
    if (newPassword.length < 8) {
      showError("Mật khẩu phải có ít nhất 8 ký tự");
      return;
    }

    const result = await resetPassword(userId, {
      password: newPassword,
      password_confirmation: confirmPassword,
    });

    if (result.success) {
      success("Đã reset mật khẩu thành công!");
      setShowResetPassword(false);
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const handleActivate = async () => {
    const result = await activateUser(userId);
    if (result.success) {
      success("Đã kích hoạt tài khoản thành công!");
      refetch();
    }
  };

  const handleDeactivate = async () => {
    const result = await deactivateUser(userId);
    if (result.success) {
      success("Đã vô hiệu hóa tài khoản thành công!");
      refetch();
    }
  };

  const tabs = [
    { id: "overview", label: "Tổng quan", icon: ChartBarIcon },
  ];

  const roleLabels: Record<string, string> = {
    admin: "Quản trị viên",
    super_admin: "Quản trị viên hệ thống",
    tutor: "Giáo viên",
    student: "Học viên",
    parent: "Phụ huynh",
  };

  return (
    <div className="space-y-6">
      <ConfirmDeleteDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        loading={deleting}
        message="Bạn có chắc chắn muốn xóa người dùng này? Hành động không thể hoàn tác."
      />

      {/* Reset Password Dialog */}
      {showResetPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-lg bg-white p-4 sm:p-6 shadow-lg dark:bg-gray-800 max-w-md w-full mx-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
              Reset mật khẩu
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Mật khẩu mới
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  placeholder="Nhập mật khẩu mới"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Xác nhận mật khẩu
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  placeholder="Nhập lại mật khẩu"
                />
              </div>
            </div>
            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={handleResetPassword}
                disabled={resettingPassword}
                className="flex-1 rounded-lg bg-primary px-4 py-2 font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resettingPassword ? "Đang xử lý..." : "Reset mật khẩu"}
              </button>
              <button
                onClick={() => {
                  setShowResetPassword(false);
                  setNewPassword("");
                  setConfirmPassword("");
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <Button
          onClick={handleGoBack}
          variant="outline"
          size="sm"
          icon={<ArrowLeftIcon />}
        >
          Quay lại
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white truncate">
            {user.name || "Người dùng"}
          </h1>
          <p className="text-sm sm:text-base text-dark-4 dark:text-dark-6 mt-1">
            Chi tiết thông tin {roleLabels[user.role] || user.role}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink
            href={`/users/${userId}/edit`}
            variant="outline"
            size="sm"
            icon={<PencilIcon />}
            disabled={!can("update", "user")}
          >
            Chỉnh sửa
          </ButtonLink>
          <Button
            onClick={() => setConfirmDelete(true)}
            variant="danger"
            size="sm"
            icon={<TrashIcon />}
            disabled={!can("delete", "user")}
          >
            Xóa
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab Content */}
      <TabPanel activeTab={activeTab} tabId="overview">
        <div className="space-y-4 sm:space-y-6">
          {/* User Info */}
          <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
              Thông tin người dùng
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Họ và tên
                </label>
                <p className="text-gray-900 dark:text-white">{user.name || "N/A"}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Email
                </label>
                <p className="text-gray-900 dark:text-white">{user.email || "N/A"}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Số điện thoại
                </label>
                <p className="text-gray-900 dark:text-white">{user.phone || "Chưa có"}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Vai trò
                </label>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.role === 'admin' || user.role === 'super_admin'
                  ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/20 dark:text-primary-400'
                  : user.role === 'tutor'
                    ? 'bg-primary-pastel/40 text-primary'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                  {roleLabels[user.role] || user.role || "N/A"}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Trạng thái
                </label>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.status === 'active' || !user.status
                  ? 'bg-primary-pastel text-primary'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                  {user.status === 'active' || !user.status ? 'Hoạt động' : 'Tạm khóa'}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
              Thao tác
            </h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowResetPassword(true)}
                disabled={!can("update", "user") || resettingPassword}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <KeyIcon className="h-4 w-4" />
                Reset mật khẩu
              </button>
              {user.status === 'inactive' ? (
                <button
                  onClick={handleActivate}
                  disabled={!can("update", "user") || activating}
                  className="inline-flex items-center gap-2 rounded-lg border border-primary/50 px-4 py-2 font-medium text-primary transition-colors hover:bg-primary-pastel/40 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircleIcon className="h-4 w-4" />
                  {activating ? "Đang kích hoạt..." : "Kích hoạt tài khoản"}
                </button>
              ) : (
                <button
                  onClick={handleDeactivate}
                  disabled={!can("update", "user") || deactivating}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <XCircleIcon className="h-4 w-4" />
                  {deactivating ? "Đang vô hiệu hóa..." : "Vô hiệu hóa tài khoản"}
                </button>
              )}
            </div>
          </div>
        </div>
      </TabPanel>
    </div>
  );
}

