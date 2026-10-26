"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import InputGroup from "@/components/FormElements/InputGroup";
import { Switch } from "@/components/FormElements/switch";
import { useCreateSubject } from "@/hooks/use-api";
import { useGoBack } from "@/hooks/use-go-back";
import { useAuthContext } from "@/contexts/auth-context";
import { useResourceGuard } from "@/lib/permission-guards";
import { ArrowLeftIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { useNotification } from "@/hooks/use-notification";
import { extractErrorMessage, extractFieldErrors } from "@/lib/api-error-utils";
import Button from "@/components/Common/Button";
import ButtonLink from "@/components/Common/ButtonLink";
import { cn } from "@/lib/utils";

export default function CreateSubjectPage() {
  const router = useRouter();
  const { user } = useAuthContext();
  const handleGoBack = useGoBack('/subjects');

  // Use resource guard to protect this route
  const { hasAccess, isChecking } = useResourceGuard(
    user,
    'create',
    'subject',
    '/403'
  );

  const { mutate: createSubject, loading: createLoading } = useCreateSubject();
  const { success, error: showError } = useNotification();

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    is_active: true,
    order: "0",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Show nothing while checking or redirecting (after all hooks)
  if (isChecking || !hasAccess) {
    return null;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
    // Xóa lỗi của field khi user bắt đầu nhập lại
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
      errors.name = "Vui lòng nhập tên môn học";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});

    const result = await createSubject({
      name: formData.name.trim(),
      code: formData.code.trim() || undefined,
      description: formData.description.trim() || undefined,
      is_active: formData.is_active,
      order: parseInt(formData.order) || 0,
    });

    if (result.success) {
      success("Tạo môn học thành công!");
      router.push("/subjects");
    } else {
      // Sử dụng utility function để extract errors
      const errors = extractFieldErrors(result);
      const errorMessage = extractErrorMessage(result, "Có lỗi xảy ra khi tạo môn học");

      setFieldErrors(errors);
      showError(errorMessage);
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
          <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white truncate">Tạo môn học mới</h1>
          <p className="text-dark-4 dark:text-dark-6 mt-1 break-words">
            Thêm môn học mới vào hệ thống
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl">
        <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <InputGroup
                label="Tên môn học"
                name="name"
                type="text"
                value={formData.name}
                handleChange={handleChange}
                placeholder="VD: Toán học, Ngữ văn, Tiếng Anh"
                required
                error={fieldErrors.name}
              />
            </div>

            <div>
              <InputGroup
                label="Mã môn (tùy chọn)"
                name="code"
                type="text"
                value={formData.code}
                handleChange={handleChange}
                placeholder="VD: MATH, LITERATURE, ENGLISH"
                error={fieldErrors.code}
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Mô tả (tùy chọn)
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                value={formData.description}
                onChange={handleChange}
                placeholder="Mô tả về môn học này..."
                className={cn(
                  "w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-white",
                  fieldErrors.description && "border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-400 dark:focus:border-red-400 dark:focus:ring-red-400"
                )}
              />
              {fieldErrors.description && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.description}</p>
              )}
            </div>

            <InputGroup
              label="Thứ tự hiển thị"
              name="order"
              type="number"
              value={formData.order}
              handleChange={handleChange}
              placeholder="0"
              min="0"
              error={fieldErrors.order}
            />

            <Switch
              name="is_active"
              checked={formData.is_active}
              onChange={handleChange}
              label="Kích hoạt môn học này"
            />

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 sm:gap-4 pt-4">
              <ButtonLink
                href="/subjects"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto justify-center"
              >
                Hủy
              </ButtonLink>
              <Button
                type="submit"
                disabled={createLoading}
                loading={createLoading}
                size="sm"
                variant="primary"
                icon={<CheckCircleIcon />}
                className="w-full sm:w-auto justify-center"
              >
                <span className="sm:hidden">Tạo</span>
                <span className="hidden sm:inline">Tạo môn học</span>
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

