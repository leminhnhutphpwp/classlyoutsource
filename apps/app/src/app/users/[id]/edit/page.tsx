"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useUser, useUpdateUser } from "@/hooks/use-api";
import InputGroup from "@/components/FormElements/InputGroup";
import SelectInput from "@/components/FormElements/SelectInput";
import { UserIcon, ArrowLeftIcon, EnvelopeIcon, PhoneIcon, MapPinIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { useAuthContext } from "@/contexts/auth-context";
import { useResourceGuard } from "@/lib/permission-guards";
import { useNotification } from "@/hooks/use-notification";
import { useGoBack } from "@/hooks/use-go-back";
import ErrorDisplay from "@/components/Common/ErrorDisplay";

export default function EditUserPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;
  const { user } = useAuthContext();

  const { data: userDetails, loading: userLoading, error: userError } = useUser(userId);
  const { mutate: updateUser, loading: updateLoading, error: updateError } = useUpdateUser();
  const { success } = useNotification();

  // Use resource guard to protect this route (check after user loads)
  const { hasAccess, isChecking } = useResourceGuard(
    user,
    'update',
    'user',
    `/users/${userId}`,
    {
      checkAfterLoad: true,
      loaded: !userLoading && !!userDetails,
    }
  );

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    bio: "",
    status: "active",
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (userDetails) {
      setFormData({
        name: userDetails.name || "",
        email: userDetails.email || "",
        phone: userDetails.phone || "",
        address: userDetails.address || "",
        bio: userDetails.bio || "",
        status: userDetails.status || "active",
      });
    }
  }, [userDetails]);

  // Use browser history navigation
  const handleGoBack = useGoBack(`/users/${userId}`);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      return;
    }

    // Clear previous errors
    setFieldErrors({});

    const result = await updateUser(userId, {
      name: formData.name,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      address: formData.address || undefined,
      bio: formData.bio || undefined,
      status: formData.status as 'active' | 'inactive',
    });

    if (result.success) {
      success("Cập nhật người dùng thành công");
      setTimeout(() => {
        router.push(`/users/${userId}`);
      }, 500);
    } else if (result.errors && typeof result.errors === 'object') {
      // Set field-specific errors
      setFieldErrors(result.errors as Record<string, string[]>);
    }
  };

  // Consolidate loading state
  const isLoading = userLoading || isChecking;

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center gap-4">
          <div className="h-10 w-24 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="flex-1">
            <div className="h-8 w-64 rounded bg-gray-200 dark:bg-gray-700 animate-pulse mb-2" />
            <div className="h-4 w-48 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
          </div>
        </div>

        {/* Form Skeleton */}
        <div className="max-w-2xl rounded-lg bg-white p-6 dark:bg-gray-800">
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-12 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-12 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-12 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-24 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-32 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-12 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="flex items-center gap-4">
              <div className="h-12 w-40 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-12 w-20 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (userError && !userLoading) {
    return <ErrorDisplay error={userError} title="Lỗi tải dữ liệu người dùng" onRetry={() => window.location.reload()} />;
  }

  // Show nothing while checking permissions or redirecting (only after loading is done)
  // Note: user hook doesn't return separate 'permissions' object currently used in other pages, 
  // so we rely on useResourceGuard's hasAccess.
  if (!isLoading && !hasAccess) {
    return null;
  }

  const roleLabels: Record<string, string> = {
    admin: "Admin",
    tutor: "Giáo viên",
    center: "Trung tâm",
    staff: "Nhân viên",
    student: "Học viên",
    parent: "Phụ huynh",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleGoBack}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Quay lại
        </button>

        <div className="flex-1">
          <h1 className="text-2xl font-bold text-dark dark:text-white">Chỉnh sửa người dùng</h1>
          <p className="text-dark-4 dark:text-dark-6 mt-1">
            Cập nhật thông tin {roleLabels[userDetails.role] || userDetails.role} &quot;{userDetails.name}&quot;
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-2xl rounded-lg bg-white p-6 dark:bg-gray-800 space-y-6">
        {updateError && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {updateError}
          </div>
        )}

        <InputGroup
          type="text"
          label="Họ và tên"
          placeholder="Nhập họ và tên"
          name="name"
          value={formData.name}
          handleChange={handleChange}
          icon={<UserIcon />}
          required
        />

        <div>
          <InputGroup
            type="email"
            label="Email"
            placeholder="Nhập email"
            name="email"
            value={formData.email}
            handleChange={handleChange}
            icon={<EnvelopeIcon />}
            required
          />
          {fieldErrors.email && fieldErrors.email.length > 0 && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {fieldErrors.email[0]}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Email phải là duy nhất (không được trùng với người dùng khác)
          </p>
        </div>

        <div>
          <InputGroup
            type="tel"
            label="Số điện thoại"
            placeholder="Nhập số điện thoại (tùy chọn)"
            name="phone"
            value={formData.phone}
            handleChange={handleChange}
            icon={<PhoneIcon />}
          />
          {fieldErrors.phone && fieldErrors.phone.length > 0 && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {fieldErrors.phone[0]}
            </p>
          )}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
            Địa chỉ
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <MapPinIcon className="h-5 w-5 text-gray-400" />
            </div>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Nhập địa chỉ (tùy chọn)"
              rows={3}
              className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 py-3 text-gray-900 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-primary"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
            Giới thiệu bản thân
          </label>
          <textarea
            name="bio"
            value={formData.bio}
            onChange={handleChange}
            placeholder="Nhập giới thiệu bản thân (tùy chọn)"
            rows={4}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-primary"
          />
        </div>

        <SelectInput
          label="Trạng thái"
          name="status"
          value={formData.status}
          onChange={handleChange}
          options={[
            { value: "active", label: "Hoạt động" },
            { value: "inactive", label: "Tạm dừng" },
          ]}
        />

        {/* Read-only fields */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/50">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Thông tin không thể chỉnh sửa</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Vai trò
              </label>
              <p className="text-gray-900 dark:text-white">
                {roleLabels[userDetails.role] || userDetails.role || "N/A"}
              </p>
            </div>
            {userDetails.center && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Trung tâm
                </label>
                <p className="text-gray-900 dark:text-white">
                  {userDetails.center.name || "N/A"}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-4 pt-4">
          <Link
            href={`/users/${userId}`}
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm sm:px-6 sm:py-3 sm:text-base font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 whitespace-nowrap"
          >
            Hủy
          </Link>
          <button
            type="submit"
            disabled={updateLoading}
            className="flex items-center rounded-lg bg-primary px-4 py-2.5 text-sm sm:px-6 sm:py-3 sm:text-base font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {updateLoading ? (
              <>
                <ArrowPathIcon className="mr-1.5 sm:mr-2 h-4 w-4 animate-spin" />
                <span className="hidden sm:inline">Đang cập nhật...</span>
              </>
            ) : (
              <>
                <ArrowPathIcon className="mr-1.5 sm:mr-2 h-4 w-4" />
                <span className="sm:hidden">Cập nhật</span>
                <span className="hidden sm:inline">Cập nhật người dùng</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

