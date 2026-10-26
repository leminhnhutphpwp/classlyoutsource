"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useStudentDetails, useUpdateStudent } from "@/hooks/use-api";
import { useGoBack } from "@/hooks/use-go-back";
import InputGroup from "@/components/FormElements/InputGroup";
import SelectInput from "@/components/FormElements/SelectInput";
import DateInput from "@/components/FormElements/DateInput";
import { UserIcon, ArrowLeftIcon, EnvelopeIcon, PhoneIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { useAuthContext } from "@/contexts/auth-context";
import { useResourceGuard } from "@/lib/permission-guards";
import { useNotification } from "@/hooks/use-notification";
import Button from "@/components/Common/Button";
import ButtonLink from "@/components/Common/ButtonLink";
import { cn } from "@/lib/utils";
import { extractFieldErrors } from "@/lib/api-error-utils";
import ErrorDisplay from "@/components/Common/ErrorDisplay";

export default function EditStudentPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.id as string;
  const { user } = useAuthContext();

  // All hooks must be called before any early returns
  const { data: studentDetails, loading: studentLoading, error: studentError, permissions } = useStudentDetails(studentId);
  const { mutate: updateStudent, loading: updateLoading, error: updateError } = useUpdateStudent();
  const { success } = useNotification();

  // Use resource guard to protect this route (check after student loads)
  const { hasAccess, isChecking } = useResourceGuard(
    user,
    'update',
    'student',
    `/students/${studentId}`,
    {
      checkAfterLoad: true,
      loaded: !studentLoading && !!studentDetails,
    }
  );

  // Use browser history navigation
  const handleGoBack = useGoBack(`/students/${studentId}`);

  // Check permissions from API response
  const canManageFromApi = permissions?.can_manage ?? false;

  // All hooks must be called before any early returns
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    parent_name: "",
    birth_date: "",
    gender: "",
    address: "",
    notes: "",
    status: "active",
    student_code: "",
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (studentDetails) {
      setFormData({
        name: studentDetails.name || "",
        email: studentDetails.email || "",
        phone: studentDetails.phone || "",
        parent_name: studentDetails.parent_name || "",
        birth_date: studentDetails.birth_date || "",
        gender: studentDetails.gender || "",
        address: studentDetails.address || "",
        notes: studentDetails.notes || "",
        status: studentDetails.status || "active",
        student_code: studentDetails.student_code || "",
      });
    }
  }, [studentDetails]);

  // Consolidate loading state - check loading FIRST before permission checks
  const isLoading = studentLoading || isChecking;

  // Show loading skeleton FIRST - before any permission checks
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
              <div className="h-3 w-64 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-12 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-3 w-64 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-28 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-12 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-12 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-12 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
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

  if (studentError && !studentLoading) {
    return <ErrorDisplay error={studentError} title="Lỗi tải dữ liệu học viên" onRetry={() => window.location.reload()} />;
  }

  // Show nothing while checking permissions or redirecting (only after loading is done)
  if (!isLoading && (!hasAccess || (studentDetails && permissions !== undefined && !canManageFromApi))) {
    return null;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors: Record<string, string> = {};
    if (!formData.name.trim()) {
      errors.name = "Vui lòng nhập họ và tên";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    // Clear previous errors
    setFieldErrors({});

    const result = await updateStudent(studentId, {
      name: formData.name,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      parent_name: formData.parent_name || undefined,
      birth_date: formData.birth_date || undefined,
      gender: formData.gender || undefined,
      address: formData.address || undefined,
      notes: formData.notes || undefined,
      status: formData.status as 'active' | 'inactive',
      student_code: formData.student_code || undefined,
    });

    if (result.success) {
      success("Cập nhật học viên thành công");
      setTimeout(() => {
        router.push(`/students/${studentId}`);
      }, 500);
    } else {
      const apiErrors = extractFieldErrors(result);
      setFieldErrors(apiErrors);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <Button
          onClick={handleGoBack}
          variant="outline"
          size="sm"
          icon={<ArrowLeftIcon />}
          className="w-full sm:w-auto justify-center"
        >
          Quay lại
        </Button>

        <div className="flex-1 w-full">
          <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white truncate">Chỉnh sửa học viên</h1>
          <p className="text-sm sm:text-base text-dark-4 dark:text-dark-6 mt-1 break-words">
            Cập nhật thông tin học viên &quot;{studentDetails.name}&quot;
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
          error={fieldErrors.name}
        />

        <div>
          <InputGroup
            type="email"
            label="Email"
            placeholder="Nhập email (tùy chọn)"
            name="email"
            value={formData.email}
            handleChange={handleChange}
            icon={<EnvelopeIcon />}
            error={fieldErrors.email}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Email phải là duy nhất (không được trùng với học viên khác)
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
            error={fieldErrors.phone}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Số điện thoại phải là duy nhất (không được trùng với học viên khác)
          </p>
        </div>

        <InputGroup
          type="text"
          label="Tên phụ huynh"
          placeholder="Nhập tên phụ huynh (tùy chọn)"
          name="parent_name"
          value={formData.parent_name}
          handleChange={handleChange}
          icon={<UserIcon />}
          error={fieldErrors.parent_name}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <DateInput
              label="Ngày sinh"
              name="birth_date"
              value={formData.birth_date}
              handleChange={handleChange}
              placeholder="Chọn ngày sinh"
              error={fieldErrors.birth_date}
            />
          </div>

          <SelectInput
            label="Giới tính"
            name="gender"
            value={formData.gender}
            onChange={handleChange}
            error={fieldErrors.gender}
            options={[
              { value: "", label: "Chọn giới tính" },
              { value: "male", label: "Nam" },
              { value: "female", label: "Nữ" },
              { value: "other", label: "Khác" },
            ]}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
            Địa chỉ
          </label>
          <textarea
            name="address"
            value={formData.address}
            onChange={handleChange}
            placeholder="Nhập địa chỉ (tùy chọn)"
            rows={3}
            className={cn(
              "w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-primary",
              fieldErrors.address && "border-red-500 focus:border-red-500 dark:border-red-400 dark:focus:border-red-400"
            )}
          />
          {fieldErrors.address && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {fieldErrors.address}
            </p>
          )}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
            Ghi chú
          </label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            placeholder="Nhập ghi chú (tùy chọn)"
            rows={4}
            className={cn(
              "w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-primary",
              fieldErrors.notes && "border-red-500 focus:border-red-500 dark:border-red-400 dark:focus:border-red-400"
            )}
          />
          {fieldErrors.notes && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {fieldErrors.notes}
            </p>
          )}
        </div>



        <InputGroup
          type="text"
          label="Mã học viên"
          placeholder="VD: HV2024001"
          name="student_code"
          value={formData.student_code}
          handleChange={handleChange}
          error={fieldErrors.student_code}
          helperText="Mã quản lý nội bộ học viên."
        />

        <SelectInput
          label="Trạng thái"
          name="status"
          value={formData.status}
          onChange={handleChange}
          options={[
            { value: "active", label: "Đang học" },
            { value: "inactive", label: "Tạm dừng" },
          ]}
        />

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 sm:gap-4">
          <Button
            type="submit"
            disabled={updateLoading}
            loading={updateLoading}
            size="sm"
            variant="primary"
            icon={<CheckCircleIcon />}
            className="w-full sm:w-auto justify-center"
          >
            Cập nhật học viên
          </Button>

          <ButtonLink
            href={`/students/${studentId}`}
            variant="outline"
            size="sm"
            className="w-full sm:w-auto justify-center"
          >
            Hủy
          </ButtonLink>
        </div>
      </form>
    </div>
  );
}

