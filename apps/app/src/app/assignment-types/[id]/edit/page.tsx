"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import InputGroup from "@/components/FormElements/InputGroup";
import { Switch } from "@/components/FormElements/switch";
import { useAssignmentType, useUpdateAssignmentType } from "@/hooks/use-api";
import { useGoBack } from "@/hooks/use-go-back";
import { useAuthContext } from "@/contexts/auth-context";
import { useResourceGuard } from "@/lib/permission-guards";
import { ArrowLeftIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { useNotification } from "@/hooks/use-notification";
import { extractErrorMessage, extractFieldErrors } from "@/lib/api-error-utils";
import Button from "@/components/Common/Button";
import ButtonLink from "@/components/Common/ButtonLink";
import { cn } from "@/lib/utils";

export default function EditAssignmentTypePage() {
  const params = useParams();
  const router = useRouter();
  const assignmentTypeId = params.id as string;
  const { user } = useAuthContext();
  const handleGoBack = useGoBack('/assignment-types');

  // All hooks must be called before any early returns
  const { data: assignmentType, loading: assignmentTypeLoading, error: assignmentTypeError } = useAssignmentType(assignmentTypeId);
  const { mutate: updateAssignmentType, loading: updateLoading } = useUpdateAssignmentType();
  const { success, error: showError } = useNotification();

  // Use resource guard to protect this route (check after assignmentType loads)
  const { hasAccess, isChecking } = useResourceGuard(
    user,
    'update',
    'assignment::type',
    '/assignment-types',
    {
      checkAfterLoad: true,
      loaded: !assignmentTypeLoading && !!assignmentType,
    }
  );

  // All hooks must be called before any early returns
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    is_active: true,
    order: "0",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (assignmentType) {
      setFormData({
        name: assignmentType.name || "",
        code: assignmentType.code || "",
        description: assignmentType.description || "",
        is_active: assignmentType.is_active ?? true,
        order: (assignmentType.order || 0).toString(),
      });
    }
  }, [assignmentType]);

  // Show loading while checking permission or loading data
  if (isChecking || assignmentTypeLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="max-w-2xl rounded-lg bg-white p-6  dark:bg-gray-800 space-y-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
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
    setFieldErrors({});

    if (!formData.name.trim()) {
      showError("Vui lòng nhập tên loại bài tập");
      return;
    }

    const result = await updateAssignmentType(assignmentTypeId, {
      name: formData.name.trim(),
      code: formData.code.trim() || undefined,
      description: formData.description.trim() || undefined,
      is_active: formData.is_active,
      order: parseInt(formData.order) || 0,
    });

    if (result.success) {
      success("Cập nhật loại bài tập thành công!");
      router.push("/assignment-types");
    } else {
      // Sử dụng utility function để extract errors
      const errors = extractFieldErrors(result);
      const errorMessage = extractErrorMessage(result, "Có lỗi xảy ra khi cập nhật loại bài tập");

      setFieldErrors(errors);
      showError(errorMessage);
    }
  };

  if (assignmentTypeError || (!assignmentTypeLoading && !assignmentType)) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
        <h3 className="font-medium mb-2">Lỗi tải dữ liệu</h3>
        <p>{assignmentTypeError || "Không tìm thấy loại bài tập"}</p>
      </div>
    );
  }

  // Show nothing if no access (only after loading is done)
  if (!isChecking && !hasAccess) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <Button
          onClick={handleGoBack}
          variant="outline"
          size="sm"
          icon={<ArrowLeftIcon />}
        >
          Quay lại
        </Button>

        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white truncate">Chỉnh sửa loại bài tập</h1>
          <p className="text-dark-4 dark:text-dark-6 mt-1">
            Cập nhật thông tin loại bài tập
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl">
        <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
          <form onSubmit={handleSubmit} className="space-y-6">
            <InputGroup
              label="Tên loại bài tập"
              name="name"
              type="text"
              value={formData.name}
              handleChange={handleChange}
              placeholder="VD: Bài tập về nhà, Bài kiểm tra, Bài thi"
              required
              error={fieldErrors.name}
            />

            <InputGroup
              label="Mã loại (tùy chọn)"
              name="code"
              type="text"
              value={formData.code}
              handleChange={handleChange}
              placeholder="VD: HOMEWORK, QUIZ, EXAM"
              error={fieldErrors.code}
            />

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
                placeholder="Mô tả về loại bài tập này..."
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
            />

            <Switch
              name="is_active"
              checked={formData.is_active}
              onChange={handleChange}
              label="Kích hoạt loại bài tập này"
            />

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 sm:gap-4 pt-4">
              <ButtonLink
                href="/assignment-types"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto justify-center"
              >
                Hủy
              </ButtonLink>
              <Button
                type="submit"
                disabled={updateLoading}
                loading={updateLoading}
                size="sm"
                variant="primary"
                icon={<CheckCircleIcon />}
                className="w-full sm:w-auto justify-center"
              >
                Cập nhật
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

