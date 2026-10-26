"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUsers, useDeleteUser } from "@/hooks/use-api";
import { useNotification } from "@/hooks/use-notification";
import { useAuthorization } from "@/lib/authz";
import { useStudentGuard } from "@/hooks/use-role-guard";
import { PlusIcon, EyeIcon, PencilIcon, TrashIcon, UserGroupIcon, ShieldCheckIcon, UserIcon, EnvelopeIcon, PhoneIcon } from "@heroicons/react/24/outline";
import ConfirmDeleteDialog from '@/components/Common/ConfirmDeleteDialog';
import Pagination from "@/components/Common/Pagination";
import { useListPage } from "@/hooks/use-list-page";
import { CardSkeleton, GridSkeleton, ListSkeleton } from "@/components/ui/loading";
import { getObjId } from "@/lib/id-utils";
import ButtonLink from "@/components/Common/ButtonLink";
import Button from "@/components/Common/Button";
import ErrorDisplay from "@/components/Common/ErrorDisplay";

export default function UsersPage() {
  const router = useRouter();
  const { can } = useAuthorization();
  const { isBlocked } = useStudentGuard();

  // Use combined hook for pagination and filters
  const {
    currentPage,
    setCurrentPage,
    filters,
    updateFilter,
    apiFilters,
  } = useListPage({
    defaultPage: 1,
    defaultPerPage: 10,
    filterKeys: ["search"],
    filterDefaults: {
      search: "",
    },
  });

  // Extract individual filters for easier access
  const searchTerm = filters.search || "";

  useEffect(() => {
    // Also check permission
    if (typeof window !== "undefined" && !(can("view", "user") || can("view_any", "user"))) {
      router.replace('/403');
    }
  }, [can, router]);

  const { data: users, loading, error, refetch, meta: usersMeta } = useUsers(apiFilters);
  const { mutate: deleteUser, loading: deleting } = useDeleteUser();
  const { success, error: showError } = useNotification();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  // In tutor-only system, tutors can manage users (based on permissions)

  if (isBlocked || !(can("view", "user") || can("view_any", "user"))) {
    return null;
  }

  const handleDelete = (userId: string) => {
    setSelectedUserId(userId);
    setConfirmDelete(true);
  };

  const handleConfirmDelete = async () => {
    if (selectedUserId) {
      try {
        const result = await deleteUser(selectedUserId);
        if (result?.success) {
          success('Xóa giáo viên thành công');
          refetch();
          setConfirmDelete(false);
          setSelectedUserId(null);
        } else {
          showError(result?.message || 'Không thể xóa giáo viên');
        }
      } catch (err: any) {
        showError(err?.message || 'Không thể xóa giáo viên');
      }
    }
  };

  if (error && !loading) {
    return <ErrorDisplay error={error} title="Quản lý giáo viên" onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white">Quản lý giáo viên</h1>
          <p className="text-dark-4 dark:text-dark-6 mt-1">
            Quản lý tất cả giáo viên trong hệ thống
          </p>
        </div>

        <ButtonLink
          href="/users/create"
          icon={<PlusIcon />}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-white transition-colors hover:bg-primary/90"
          disabled={!can("create", "user")}
        >
          Thêm giáo viên mới
        </ButtonLink>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
        {loading ? (
          <GridSkeleton
            count={4}
            cols={{ mobile: 1, tablet: 2, desktop: 4 }}
            renderItem={(i) => (
              <CardSkeleton
                key={i}
                showAvatar={false}
                showActions={false}
                lines={1}
                className="rounded-lg bg-white p-4 dark:bg-gray-800 md:p-6"
              />
            )}
          />
        ) : (
          <>
            <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
              <div className="flex items-center">
                <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                  <UserGroupIcon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                </div>
                <div className="ml-3 md:ml-4 min-w-0 flex-1">
                  <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Tổng giáo viên">Tổng giáo viên</p>
                  <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white truncate">
                    {(usersMeta as any)?.statistics?.total ?? usersMeta?.total ?? 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
              <div className="flex items-center">
                <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                  <ShieldCheckIcon className="h-6 w-6 text-primary" />
                </div>
                <div className="ml-4 min-w-0 flex-1">
                  <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Admin">Admin</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white truncate">
                    {(usersMeta as any)?.statistics?.admin ?? 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
              <div className="flex items-center">
                <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                  <UserIcon className="h-6 w-6 text-primary-light" />
                </div>
                <div className="ml-4 min-w-0 flex-1">
                  <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Giáo viên">Giáo viên</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white truncate">
                    {(usersMeta as any)?.statistics?.tutor ?? 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
              <div className="flex items-center">
                <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                  <UserIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                </div>
                <div className="ml-4 min-w-0 flex-1">
                  <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Hoạt động">Hoạt động</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white truncate">
                    {(usersMeta as any)?.statistics?.active ?? 0}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Tìm kiếm giáo viên..."
            value={searchTerm}
            onChange={(e) => updateFilter("search", e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-primary"
          />
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <ListSkeleton count={5} showAvatar={true} />
      ) : !users || users.length === 0 ? (
        <div className="rounded-lg bg-white p-8 text-center dark:bg-gray-800">
          <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
            <UserGroupIcon className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {searchTerm ? "Không tìm thấy giáo viên" : "Chưa có giáo viên nào"}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {searchTerm
              ? "Thử thay đổi từ khóa tìm kiếm"
              : "Bắt đầu bằng cách thêm giáo viên đầu tiên"
            }
          </p>
          {!searchTerm && (
            <ButtonLink
              href="/users/create"
              icon={<PlusIcon />}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-white transition-colors hover:bg-primary/90"
              disabled={!can("create", "user")}
            >
              Thêm người dùng đầu tiên
            </ButtonLink>
          )}
        </div>
      ) : (
        <div className="rounded-lg bg-white dark:bg-gray-800 overflow-hidden">
          {/* Mobile Card View */}
          <div className="block lg:hidden divide-y divide-gray-200 dark:divide-gray-700">
            {(users || []).map((user: any) => {
              const userId = getObjId(user);
              return (
                <div key={userId} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="h-12 w-12 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-lg font-medium text-gray-700 dark:text-gray-300">
                          {user.name?.charAt(0).toUpperCase() || 'U'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {user.name || 'N/A'}
                          </h3>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${user.status === 'active' || !user.status
                              ? 'bg-primary-pastel text-primary'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                              }`}>
                              {user.status === 'active' || !user.status ? 'Hoạt động' : 'Tạm khóa'}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-1.5 mb-3">
                          {user.email && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1.5">
                              <EnvelopeIcon className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{user.email || 'N/A'}</span>
                            </div>
                          )}
                          {user.phone && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1.5">
                              <PhoneIcon className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{user.phone}</span>
                            </div>
                          )}
                          <div className="mt-2">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${user.role === 'admin'
                              ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/20 dark:text-primary-400'
                              : user.role === 'tutor'
                                ? 'bg-primary-pastel/40 text-primary'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                              }`}>
                              {user.role === 'admin' ? 'Admin' :
                                user.role === 'super_admin' ? 'Super Admin' :
                                  user.role === 'tutor' ? 'Giáo viên' :
                                    user.role === 'student' ? 'Học viên' :
                                      user.role === 'parent' ? 'Phụ huynh' : user.role || 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <ButtonLink
                        href={`/users/${userId}`}
                        variant="ghost"
                        className="!p-1.5 !h-auto text-primary hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </ButtonLink>
                      <ButtonLink
                        href={`/users/${userId}/edit`}
                        variant="ghost"
                        className="!p-1.5 !h-auto text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        disabled={!can("update", "user")}
                      >
                        <PencilIcon className="h-4 w-4" />
                      </ButtonLink>
                      <Button
                        onClick={() => handleDelete(userId)}
                        variant="ghost"
                        className="!p-1.5 !h-auto text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title="Xóa giáo viên"
                        disabled={!can("delete", "user")}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="min-w-[800px] w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Người dùng
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Vai trò
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Trạng thái
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {(users || []).map((user: any) => {
                  const userId = getObjId(user);
                  return (
                    <tr key={userId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {user.name?.charAt(0).toUpperCase() || 'U'}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {user.name || 'N/A'}
                            </div>
                            {user.phone && (
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {user.phone}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {user.email || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${user.role === 'admin'
                          ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/20 dark:text-primary-400'
                          : user.role === 'tutor'
                            ? 'bg-primary-pastel/40 text-primary'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                          {user.role === 'admin' ? 'Admin' :
                            user.role === 'super_admin' ? 'Super Admin' :
                              user.role === 'tutor' ? 'Giáo viên' :
                                user.role === 'student' ? 'Học viên' :
                                  user.role === 'parent' ? 'Phụ huynh' : user.role || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${user.status === 'active' || !user.status
                          ? 'bg-primary-pastel text-primary'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                          {user.status === 'active' || !user.status ? 'Hoạt động' : 'Tạm khóa'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <ButtonLink
                            href={`/users/${userId}`}
                            variant="ghost"
                            className="!p-0 h-auto text-primary hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-transparent"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </ButtonLink>
                          <ButtonLink
                            href={`/users/${userId}/edit`}
                            variant="ghost"
                            className="!p-0 h-auto text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-transparent"
                            disabled={!can("update", "user")}
                          >
                            <PencilIcon className="h-4 w-4" />
                          </ButtonLink>
                          <Button
                            onClick={() => handleDelete(userId)}
                            variant="ghost"
                            className="!p-0 h-auto text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-transparent"
                            title="Xóa giáo viên"
                            disabled={!can("delete", "user")}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination - chỉ hiển thị khi có dữ liệu */}
      {users && users.length > 0 && (
        <Pagination
          meta={usersMeta}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          itemLabel="giáo viên"
          className="mt-6"
        />
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDeleteDialog
        open={confirmDelete}
        onClose={() => {
          setConfirmDelete(false);
          setSelectedUserId(null);
        }}
        onConfirm={handleConfirmDelete}
        message={`Bạn có chắc chắn muốn xóa giáo viên "${selectedUserId ? users?.find((u: any) => getObjId(u) === selectedUserId)?.name : ''}"? Hành động này không thể hoàn tác.`}
        loading={deleting}
      />
    </div>
  );
}

