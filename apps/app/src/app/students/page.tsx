"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useStudents, useDeleteStudent, useClasses, useResetStudentPassword } from "@/hooks/use-api";
import { useAuthorization } from "@/lib/authz";
import { useNotification } from "@/hooks/use-notification";
import { PlusIcon, EyeIcon, EyeSlashIcon, PencilIcon, TrashIcon, UserGroupIcon, SparklesIcon, XMarkIcon, ArrowPathIcon, LockClosedIcon, CheckIcon } from "@heroicons/react/24/outline";
import ConfirmDeleteDialog from '@/components/Common/ConfirmDeleteDialog';
import Tooltip from "@/components/Common/Tooltip";
import SelectInput from "@/components/FormElements/SelectInput";
import SearchInput from "@/components/FormElements/SearchInput";
import ButtonLink from "@/components/Common/ButtonLink";
import Button from "@/components/Common/Button";
import Pagination from "@/components/Common/Pagination";
import { tableStyles } from "@/components/Common/tableStyles";
import { useListPage } from "@/hooks/use-list-page";
import { useLockContext } from "@/contexts/lock-context";
import { useErrorDisplay } from "@/components/Common/ErrorDisplay";
import { useTutorGuard } from "@/hooks/use-role-guard";
import { StudentCard } from "@/components/Students/StudentCard";
import { StatsCardSkeleton } from "@/components/ui/loading";
import { getObjId } from "@/lib/id-utils";
import UserInfoBox from "@/components/User/UserInfoBox";

export default function StudentsPage() {
  const { isBlocked } = useTutorGuard(); // Block students from accessing this page
  const { actionsLocked, planFeatureMessage } = useLockContext();
  const { renderError } = useErrorDisplay("Quản lý học viên");

  // Use combined hook for pagination and filters
  const {
    currentPage,
    setCurrentPage,
    filters,
    updateFilter,
    resetFilters,
    apiFilters,
  } = useListPage({
    defaultPage: 1,
    defaultPerPage: 10,
    filterKeys: ["search", "class_id"],
    filterDefaults: {
      search: "",
      class_id: "all",
    },
  });

  // Extract individual filters for easier access
  const searchQuery = filters.search || "";
  const classFilter = filters.class_id || "all";

  // Local state for search input (not triggering API call immediately)
  const [searchInput, setSearchInput] = useState(searchQuery);

  // Gọi API với đầy đủ bộ lọc
  const { data: students, loading, error, refetch, meta: studentsMeta } = useStudents(actionsLocked ? undefined : apiFilters);
  // Fetch all classes for filter dropdown (not filtered)
  const { data: allClasses, loading: classesLoading } = useClasses(actionsLocked ? undefined : { per_page: 1000 }, !actionsLocked);
  const { mutate: deleteStudent, loading: deleting } = useDeleteStudent();
  const { mutate: resetStudentPassword, loading: resettingPassword } = useResetStudentPassword();
  const { can } = useAuthorization();
  const { success, error: showError } = useNotification();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [resetPasswordModal, setResetPasswordModal] = useState<{ open: boolean; studentId: string | null; name: string | null }>({
    open: false,
    studentId: null,
    name: null,
  });
  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetPasswordConfirm, setShowResetPasswordConfirm] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  // Sync searchInput with searchQuery when filter changes externally
  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  // Reset selection when page/filter changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [currentPage, classFilter, searchQuery]);

  const handleSearch = () => {
    updateFilter("search", searchInput);
  };

  // Bulk selection logic
  const selectedCount = selectedIds.size;
  const allSelectedOnPage = students && students.length > 0 &&
    students.every((student: any) => selectedIds.has(getObjId(student)));

  const toggleSelectAllOnPage = () => {
    if (!students) return;
    if (allSelectedOnPage) {
      const newSet = new Set(selectedIds);
      students.forEach((student: any) => newSet.delete(getObjId(student)));
      setSelectedIds(newSet);
    } else {
      const newSet = new Set(selectedIds);
      students.forEach((student: any) => {
        // Only allow selection if user has delete permission
        newSet.add(getObjId(student));
      });
      setSelectedIds(newSet);
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  // Bulk delete handler
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const idsArray = Array.from(selectedIds);
    let successCount = 0;
    let errorCount = 0;

    for (const id of idsArray) {
      try {
        const result = await deleteStudent(String(id));
        if (result?.success) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch {
        errorCount++;
      }
    }

    if (successCount > 0) {
      success(`Đã xóa thành công ${successCount} học viên${successCount > 1 ? '' : ''}`);
    }
    if (errorCount > 0) {
      showError(`Không thể xóa ${errorCount} học viên`);
    }

    setSelectedIds(new Set());
    setBulkConfirmOpen(false);
    refetch();
  };

  // Disable scroll when reset password modal is open
  useEffect(() => {
    if (resetPasswordModal.open) {
      const previousBodyOverflow = document.body.style.overflow;
      const previousHtmlOverflow = document.documentElement.style.overflow;

      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";

      return () => {
        document.body.style.overflow = previousBodyOverflow || "";
        document.documentElement.style.overflow = previousHtmlOverflow || "";
      };
    }
  }, [resetPasswordModal.open]);

  // Block students - this page is for tutors only (after all hooks to keep
  // hook order stable across renders; useStudentGuard handles the redirect)
  if (isBlocked) {
    return null;
  }

  const handleDelete = (studentId: string) => {
    setSelectedStudentId(studentId);
    setConfirmDelete(true);
  };

  const handleConfirmDelete = async () => {
    if (selectedStudentId) {
      try {
        const result = await deleteStudent(selectedStudentId);
        if (result?.success) {
          success('Xóa học viên thành công');
          refetch();
          setConfirmDelete(false);
          setSelectedStudentId(null);
        } else {
          showError(result?.message || 'Không thể xóa học viên');
        }
      } catch (err: any) {
        showError(err?.message || 'Không thể xóa học viên');
      }
    }
  };

  const generateRandomPassword = () => {
    const length = 12;
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const digits = "0123456789";
    const symbols = "!@#$%^&*()-_=+[]{};:,.?";
    const all = upper + lower + digits + symbols;
    const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
    let pwd = pick(upper) + pick(lower) + pick(digits) + pick(symbols);
    for (let i = pwd.length; i < length; i++) {
      pwd += all[Math.floor(Math.random() * all.length)];
    }
    pwd = pwd.split("").sort(() => Math.random() - 0.5).join("");
    setResetPassword(pwd);
    setResetPasswordConfirm(pwd);
  };

  const openResetPassword = (student: any) => {
    setResetError(null);
    setResetPassword("");
    setResetPasswordConfirm("");
    setResetPasswordModal({ open: true, studentId: getObjId(student) || null, name: student.name || null });
  };

  const handleResetPassword = async () => {
    if (!resetPasswordModal.studentId) return;
    setResetError(null);
    const result = await resetStudentPassword({
      id: resetPasswordModal.studentId,
      password: resetPassword,
      password_confirmation: resetPasswordConfirm,
    });
    if (result?.success) {
      success("Đổi mật khẩu thành công");
      setResetPasswordModal({ open: false, studentId: null, name: null });
      setResetPassword("");
      setResetPasswordConfirm("");
    } else if (result?.errors && typeof result.errors === "object") {
      // Prefer first field error
      const firstError = Object.values(result.errors as Record<string, string[]>)[0]?.[0];
      setResetError(firstError || result.message || "Không thể đổi mật khẩu");
    } else {
      setResetError(result?.message || "Không thể đổi mật khẩu");
    }
  };

  // Kiểm tra lock trước để ưu tiên hiển thị lock content
  if (actionsLocked || planFeatureMessage) {
    return renderError();
  }

  if (error && !loading) {
    return renderError(error, () => refetch());
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white">Quản lý học viên</h1>
          <p className="text-dark-4 dark:text-dark-6 mt-1">
            Quản lý tất cả học viên của bạn
          </p>
        </div>

        <ButtonLink
          href="/students/create"
          icon={<PlusIcon />}
          size="sm"
          disabled={!can("create", "student")}
        >
          Thêm học viên mới
        </ButtonLink>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
        {loading ? (
          <>
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
          </>
        ) : (
          <>
            <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
              <div className="flex items-center">
                <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                  <UserGroupIcon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                </div>
                <div className="ml-3 md:ml-4">
                  <p className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400">Tất cả</p>
                  <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                    {(studentsMeta as any)?.statistics?.total ?? studentsMeta?.total ?? 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
              <div className="flex items-center">
                <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                  <UserGroupIcon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                </div>
                <div className="ml-3 md:ml-4">
                  <p className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400">Đang học</p>
                  <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                    {(studentsMeta as any)?.statistics?.active ?? 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
              <div className="flex items-center">
                <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                  <UserGroupIcon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                </div>
                <div className="ml-3 md:ml-4">
                  <p className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400">Đang nghỉ</p>
                  <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                    {(studentsMeta as any)?.statistics?.inactive ?? 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
              <div className="flex items-center">
                <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                  <UserGroupIcon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                </div>
                <div className="ml-3 md:ml-4">
                  <p className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400">Lớp học</p>
                  <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                    {(studentsMeta as any)?.statistics?.unique_classes ?? 0}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Search and Filters */}
      <div className="rounded-lg bg-white p-4 dark:bg-gray-800">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 relative">
          <SearchInput
            label="Tìm kiếm"
            name="search"
            placeholder={loading ? "Đang tải..." : "Tìm kiếm học viên..."}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onSearch={handleSearch}
            disabled={loading}
          />
          <SelectInput
            label="Lớp học"
            name="class_id"
            value={classFilter}
            onChange={(e) => updateFilter("class_id", e.target.value)}
            disabled={classesLoading || loading}
            options={[
              { value: "all", label: "Tất cả lớp học" },
              ...(allClasses?.map((cls: any) => {
                const classId = getObjId(cls);
                return {
                  value: classId,
                  label: cls.name,
                };
              }) || []),
            ]}
            placeholder={classesLoading || loading ? "Đang tải..." : "Chọn lớp học"}
          />

          {(searchQuery || classFilter !== "all") && (
            <button
              onClick={() => {
                setSearchInput("");
                resetFilters();
              }}
              className="absolute -top-3 right-0 text-xs font-medium text-red-500 hover:text-red-700 bg-white dark:bg-gray-800 px-2 py-0.5 rounded-full border border-gray-100 dark:border-gray-700"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* Students Table */}
      {loading ? (
        <div className="rounded-lg bg-white dark:bg-gray-800">
          <div className="overflow-visible">
            <div className="p-4 md:p-6">
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 animate-pulse">
                    <div className="h-10 md:h-12 w-10 md:w-12 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                    <div className="flex-1 space-y-2 min-w-0">
                      <div className="h-4 w-32 md:w-48 rounded bg-gray-200 dark:bg-gray-700" />
                      <div className="h-3 w-24 md:w-32 rounded bg-gray-200 dark:bg-gray-700" />
                    </div>
                    <div className="hidden sm:block h-4 w-32 rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="hidden md:block h-4 w-24 rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-6 w-16 md:w-20 rounded-full bg-gray-200 dark:bg-gray-700" />
                    <div className="h-8 w-20 md:w-24 rounded bg-gray-200 dark:bg-gray-700" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : !students || students.length === 0 ? (
        <div className="rounded-lg bg-white p-8 text-center dark:bg-gray-800">
          <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
            <UserGroupIcon className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {searchQuery ? "Không tìm thấy học viên" : "Chưa có học viên nào"}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {searchQuery
              ? "Thử thay đổi từ khóa tìm kiếm"
              : "Bắt đầu bằng cách thêm học viên đầu tiên"
            }
          </p>
          {!searchQuery && (
            <ButtonLink
              href="/students/create"
              icon={<PlusIcon />}
              size="sm"
              disabled={!can("create", "student")}
            >
              Thêm học viên đầu tiên
            </ButtonLink>
          )}
        </div>
      ) : (
        <div className={tableStyles.wrapper}>
          {/* Bulk Actions Bar */}
          {selectedCount > 0 && (
            <div className="flex items-center justify-between px-4 py-3 bg-primary-pastel/20 border-b border-primary/20 dark:bg-primary/10 dark:border-primary/30">
              <div className="text-gray-600 dark:text-gray-300">
                Đã chọn <span className="font-semibold">{selectedCount}</span> học viên
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                  icon={<XMarkIcon className="h-4 w-4" />}
                >
                  Bỏ chọn
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => setBulkConfirmOpen(true)}
                  loading={deleting}
                  icon={<TrashIcon className="h-4 w-4" />}
                  disabled={!can("delete", "student")}
                >
                  Xóa đã chọn
                </Button>
              </div>
            </div>
          )}
          {/* Mobile Card View */}
          <div className="block lg:hidden divide-y divide-gray-200 dark:divide-gray-700">
            {students.map((student: any, index: number) => {
              const studentId = getObjId(student);
              return (
                <StudentCard
                  key={studentId || index}
                  student={student}
                  onDeleteClick={(id) => handleDelete(String(id))}
                />
              );
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className={`${tableStyles.table} min-w-[1000px]`}>
              <thead className={tableStyles.thead}>
                <tr>
                  <th className={tableStyles.headerCheckboxCell}>
                    <input
                      type="checkbox"
                      className={tableStyles.checkbox}
                      checked={allSelectedOnPage}
                      onChange={toggleSelectAllOnPage}
                      disabled={!can("delete", "student")}
                    />
                  </th>
                  <th className={tableStyles.headerCellBase}>
                    Học viên
                  </th>
                  <th className={`${tableStyles.headerCellBase} hidden md:table-cell`}>
                    Lớp học
                  </th>
                  <th className={tableStyles.headerCellBase}>
                    Trạng thái
                  </th>
                  <th className={`${tableStyles.headerCellBase} hidden md:table-cell`}>
                    Khóa
                  </th>
                  <th className={`${tableStyles.headerCellBase} text-right`}>
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className={tableStyles.body}>
                {students.map((student: any, index: number) => {
                  const studentId = getObjId(student);
                  const studentIdString = studentId;
                  const pausedClasses =
                    Array.isArray(student.classes) && student.classes.length > 0
                      ? student.classes.filter((cls: any) => cls?.enrollment?.is_paused)
                      : [];

                  return (
                    <tr key={studentId || index} className={selectedIds.has(studentIdString) ? tableStyles.rowSelected : tableStyles.row}>
                      <td className={tableStyles.cellCheckbox}>
                        <input
                          type="checkbox"
                          className={tableStyles.checkbox}
                          checked={selectedIds.has(studentIdString)}
                          onChange={() => toggleSelect(studentIdString)}
                          disabled={!can("delete", "student")}
                        />
                      </td>
                      <td className={tableStyles.cell}>
                        <UserInfoBox
                          name={student.name}
                          email={student.email}
                          emailVerified={student.email_verified || false}
                          phone={student.phone}
                          avatar={student.avatar}
                          studentCode={student.student_code}
                          size="sm"
                          layout="horizontal"
                        />
                      </td>
                      <td className={`${tableStyles.cell} hidden md:table-cell`}>
                        <div className="flex flex-wrap gap-1 items-start max-w-xs">
                          {student.classes && Array.isArray(student.classes) && student.classes.length > 0 ? (
                            student.classes.map((classItem: any, idx: number) => {
                              const enrollment = classItem.enrollment;
                              const enrollmentStatus = enrollment?.status || 'active';

                              const statusColors: Record<string, string> = {
                                'active': 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]',
                                'inactive': 'bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]',
                                'completed': 'bg-[var(--status-badge-completed)] text-[var(--status-badge-completed-text)]',
                                'dropped': 'bg-[var(--status-badge-error)] text-[var(--status-badge-error-text)]',
                              };

                              const colorClass = statusColors[enrollmentStatus] || 'bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]';

                              return (
                                <span
                                  key={getObjId(classItem) || `class-${idx}`}
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}
                                >
                                  {classItem.name || 'Lớp không tên'}
                                </span>
                              );
                            })
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                              Chưa có lớp
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={tableStyles.cellStatus}>
                        <div className="flex flex-col gap-1 items-start">
                          {/* Nếu học viên chỉ có 1 lớp và lớp đó bị tạm dừng, chỉ hiển thị "lớp tạm dừng" */}
                          {pausedClasses.length > 0 && student.classes && student.classes.length === pausedClasses.length ? (
                            <span
                              className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                              title={`Đang tạm dừng tại: ${pausedClasses
                                .map((cls: any) => cls?.name || `Lớp #${getObjId(cls)}`)
                                .join(', ')}`}
                            >
                              {pausedClasses.length} lớp đang nghỉ
                            </span>
                          ) : (
                            <>
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${student.status === 'active'
                                ? 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]'
                                : 'bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]'
                                }`}>
                                {student.status === 'active' ? 'Đang học' : 'Đang nghỉ'}
                              </span>
                              {pausedClasses.length > 0 && (
                                <span
                                  className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                                  title={`Đang tạm dừng tại: ${pausedClasses
                                    .map((cls: any) => cls?.name || `Lớp #${getObjId(cls)}`)
                                    .join(', ')}`}
                                >
                                  {pausedClasses.length} lớp đang nghỉ
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                      <td className={`${tableStyles.cellStatus} hidden md:table-cell text-center`}>
                        {student.is_locked ? (
                          <Tooltip label="Đã khóa đăng nhập">
                            <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30">
                              <LockClosedIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
                            </div>
                          </Tooltip>
                        ) : (
                          <Tooltip label="Đăng nhập bình thường">
                            <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30">
                              <CheckIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                            </div>
                          </Tooltip>
                        )}
                      </td>
                      <td className={tableStyles.cellActions}>
                        <div className="flex items-center justify-end gap-1 md:gap-2">
                          <Tooltip label="Xem hồ sơ">
                            <Link
                              href={`/students/${studentIdString}`}
                              className="text-primary hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 p-1"
                              aria-label="Xem hồ sơ"
                            >
                              <EyeIcon className="h-4 w-4" />
                            </Link>
                          </Tooltip>
                          <Tooltip label="Chỉnh sửa">
                            <ButtonLink
                              href={`/students/${studentIdString}/edit`}
                              variant="ghost"
                              className="!p-1 !h-auto text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-transparent"
                              aria-label="Chỉnh sửa"
                              disabled={!can("update", "student")}
                            >
                              <PencilIcon className="h-4 w-4" />
                            </ButtonLink>
                          </Tooltip>
                          <Tooltip label="Đổi mật khẩu">
                            <Button
                              onClick={() => openResetPassword(student)}
                              variant="ghost"
                              className="!p-1 !h-auto text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 hover:bg-transparent"
                              aria-label="Đổi mật khẩu"
                              disabled={!can("update", "student")}
                            >
                              <ArrowPathIcon className="h-4 w-4" />
                            </Button>
                          </Tooltip>
                          <Tooltip label="Xóa học viên">
                            <Button
                              onClick={() => handleDelete(studentIdString)}
                              variant="ghost"
                              className="!p-1 !h-auto text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-transparent"
                              aria-label="Xóa học viên"
                              disabled={!can("delete", "student")}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          </Tooltip>
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
      {students && students.length > 0 && (
        <Pagination
          meta={studentsMeta}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          itemLabel="học viên"
          className="mt-6"
        />
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDeleteDialog
        open={confirmDelete}
        onClose={() => {
          setConfirmDelete(false);
          setSelectedStudentId(null);
        }}
        onConfirm={handleConfirmDelete}
        message={`Bạn có chắc chắn muốn xóa học viên "${selectedStudentId ? students?.find((s: any) => getObjId(s) === selectedStudentId)?.name : ''}"? Hành động này không thể hoàn tác.`}
        loading={deleting}
      />

      {/* Bulk Delete Dialog */}
      <ConfirmDeleteDialog
        open={bulkConfirmOpen}
        onClose={() => setBulkConfirmOpen(false)}
        onConfirm={handleBulkDelete}
        loading={deleting}
        message={`Bạn có chắc chắn muốn xóa ${selectedCount} học viên đã chọn? Hành động này không thể hoàn tác.`}
      />

      {/* Reset password modal - use portal to avoid overlay issues */}
      {resetPasswordModal.open &&
        createPortal(
          <div className="fixed inset-0 flex items-center justify-center z-[1000] bg-black/50 backdrop-blur-[1px] px-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Đổi mật khẩu</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Học viên: {resetPasswordModal.name || resetPasswordModal.studentId}
              </p>
              {resetError && (
                <div className="mb-3 rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200">
                  {resetError}
                </div>
              )}
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Mật khẩu mới</label>
                  <div className="relative">
                    <input
                      type={showResetPassword ? "text" : "password"}
                      name="reset_password"
                      placeholder="Tối thiểu 8 ký tự"
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      required
                    />
                    <div className="absolute inset-y-0 right-2 flex items-center gap-1">
                      <button
                        type="button"
                        className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white"
                        onClick={() => setShowResetPassword((v) => !v)}
                        aria-label={showResetPassword ? "Ẩn mật khẩu" : "Hiển thị mật khẩu"}
                      >
                        {showResetPassword ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        className="p-1 text-amber-600 hover:text-amber-700 dark:text-amber-300 dark:hover:text-amber-200"
                        onClick={generateRandomPassword}
                        aria-label="Tạo mật khẩu ngẫu nhiên"
                      >
                        <SparklesIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Nhập lại mật khẩu</label>
                  <div className="relative">
                    <input
                      type={showResetPasswordConfirm ? "text" : "password"}
                      name="reset_password_confirmation"
                      placeholder="Nhập lại mật khẩu"
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      value={resetPasswordConfirm}
                      onChange={(e) => setResetPasswordConfirm(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-2 flex items-center p-1 text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white"
                      onClick={() => setShowResetPasswordConfirm((v) => !v)}
                      aria-label={showResetPasswordConfirm ? "Ẩn mật khẩu" : "Hiển thị mật khẩu"}
                    >
                      {showResetPasswordConfirm ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-end gap-3">
                <button
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700"
                  onClick={() => setResetPasswordModal({ open: false, studentId: null, name: null })}
                  disabled={resettingPassword}
                  type="button"
                >
                  Hủy
                </button>
                <button
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
                  onClick={handleResetPassword}
                  disabled={resettingPassword}
                  type="button"
                >
                  {resettingPassword ? "Đang đổi..." : "Đổi mật khẩu"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      }
    </div>
  );
}