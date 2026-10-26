"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCreateUser } from "@/hooks/use-api";
import { useGoBack } from "@/hooks/use-go-back";
import InputGroup from "@/components/FormElements/InputGroup";
import SelectInput from "@/components/FormElements/SelectInput";
import { UserIcon, ArrowLeftIcon, EnvelopeIcon, PhoneIcon, MapPinIcon, KeyIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { useAuthContext } from "@/contexts/auth-context";
import { useResourceGuard } from "@/lib/permission-guards";
import { useNotification } from "@/hooks/use-notification";
import Button from "@/components/Common/Button";

export default function CreateUserPage() {
  const router = useRouter();
  const { user } = useAuthContext();
  const handleGoBack = useGoBack('/users');

  // Use resource guard to protect this route
  const { hasAccess, isChecking } = useResourceGuard(
    user,
    'create',
    'user',
    '/403'
  );

  const { mutate: createUser, loading: createLoading } = useCreateUser();
  const { success, error: showError } = useNotification();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    password_confirmation: "",
    phone: "",
    address: "",
    bio: "",
    role: "tutor", // Only 'tutor' is allowed in tutor-only system
    status: "active",
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  if (isChecking || !hasAccess) {
    return null;
  }

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
      showError("Vui lòng nhập họ và tên");
      return;
    }

    if (!formData.email.trim()) {
      showError("Vui lòng nhập email");
      return;
    }

    if (!formData.password.trim()) {
      showError("Vui lòng nhập mật khẩu");
      return;
    }

    if (formData.password.length < 8) {
      showError("Mật khẩu phải có ít nhất 8 ký tự");
      return;
    }

    if (formData.password !== formData.password_confirmation) {
      showError("Mật khẩu xác nhận không khớp");
      return;
    }

    // Clear previous errors
    setFieldErrors({});

    const result = await createUser({
      name: formData.name.trim(),
      email: formData.email.trim(),
      password: formData.password,
      password_confirmation: formData.password_confirmation,
      phone: formData.phone.trim() || undefined,
      address: formData.address.trim() || undefined,
      bio: formData.bio.trim() || undefined,
      role: formData.role,
      status: formData.status as 'active' | 'inactive',
    });

    if (result.success) {
      success("Tạo người dùng thành công!");
      setTimeout(() => {
        router.push("/users");
      }, 500);
    } else if (result.errors && typeof result.errors === 'object') {
      // Set field-specific errors
      setFieldErrors(result.errors as Record<string, string[]>);
    }
  };


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <Button
          onClick={handleGoBack}
          variant="outline"
          size="sm"
          icon={<ArrowLeftIcon />}
          className="w-full sm:w-auto justify-center"
        >
          Quay lại
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white truncate">Thêm giảng viên mới</h1>
          <p className="text-dark-4 dark:text-dark-6 mt-1 break-words">
            Tạo tài khoản giáo viên mới trong hệ thống
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl">
        <form onSubmit={handleSubmit} className="rounded-lg bg-white p-6 dark:bg-gray-800 space-y-6">
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
          {fieldErrors.name && fieldErrors.name.length > 0 && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {fieldErrors.name[0]}
            </p>
          )}

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
              type="password"
              label="Mật khẩu"
              placeholder="Nhập mật khẩu (tối thiểu 8 ký tự)"
              name="password"
              value={formData.password}
              handleChange={handleChange}
              icon={<KeyIcon />}
              required
            />
            {fieldErrors.password && fieldErrors.password.length > 0 && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {fieldErrors.password[0]}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Mật khẩu phải có ít nhất 8 ký tự
            </p>
          </div>

          <div>
            <InputGroup
              type="password"
              label="Xác nhận mật khẩu"
              placeholder="Nhập lại mật khẩu"
              name="password_confirmation"
              value={formData.password_confirmation}
              handleChange={handleChange}
              icon={<KeyIcon />}
              required
            />
            {fieldErrors.password_confirmation && fieldErrors.password_confirmation.length > 0 && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {fieldErrors.password_confirmation[0]}
              </p>
            )}
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
            {fieldErrors.address && fieldErrors.address.length > 0 && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {fieldErrors.address[0]}
              </p>
            )}
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
            {fieldErrors.bio && fieldErrors.bio.length > 0 && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {fieldErrors.bio[0]}
              </p>
            )}
          </div>

          <div>
            <SelectInput
              label="Vai trò"
              name="role"
              value={formData.role}
              onChange={handleChange}
              options={[
                { value: "tutor", label: "Giảng viên" },
              ]}
            />
            {fieldErrors.role && fieldErrors.role.length > 0 && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {fieldErrors.role[0]}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Chỉ có thể tạo tài khoản giáo viên (tutor-only system)
            </p>
          </div>

          <div>
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
            {fieldErrors.status && fieldErrors.status.length > 0 && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {fieldErrors.status[0]}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-4 pt-4">
            <Link
              href="/users"
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm sm:px-6 sm:py-3 sm:text-base font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 whitespace-nowrap"
            >
              Hủy
            </Link>
            <button
              type="submit"
              disabled={createLoading}
              className="flex items-center rounded-lg bg-primary px-4 py-2.5 text-sm sm:px-6 sm:py-3 sm:text-base font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {createLoading ? (
                <>
                  <ArrowPathIcon className="mr-1.5 sm:mr-2 h-4 w-4 animate-spin" />
                  <span className="hidden sm:inline">Đang tạo...</span>
                </>
              ) : (
                <>
                  <ArrowPathIcon className="mr-1.5 sm:mr-2 h-4 w-4" />
                  <span className="sm:hidden">Tạo</span>
                  <span className="hidden sm:inline">Tạo giáo viên</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

