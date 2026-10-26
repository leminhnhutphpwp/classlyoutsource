"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import InputGroup from "@/components/FormElements/InputGroup";
import { Switch } from "@/components/FormElements/switch";
import { useGradeType, useUpdateGradeType } from "@/hooks/use-api";
import { useGoBack } from "@/hooks/use-go-back";
import { useAuthContext } from "@/contexts/auth-context";
import { useResourceGuard } from "@/lib/permission-guards";
import { ArrowLeftIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { useNotification } from "@/hooks/use-notification";
import { extractErrorMessage, extractFieldErrors } from "@/lib/api-error-utils";
import Button from "@/components/Common/Button";
import ButtonLink from "@/components/Common/ButtonLink";
import { cn } from "@/lib/utils";

export default function EditGradeTypePage() {
  const params = useParams();
  const router = useRouter();
  const gradeTypeId = params.id as string;
  const { user } = useAuthContext();
  const handleGoBack = useGoBack('/grade-types');

  // All hooks must be called before any early returns
  const { data: gradeType, loading: gradeTypeLoading, error: gradeTypeError } = useGradeType(gradeTypeId);
  const { mutate: updateGradeType, loading: updateLoading } = useUpdateGradeType();
  const { success, error: showError } = useNotification();

  // Use resource guard to protect this route (check after gradeType loads)
  const { hasAccess, isChecking } = useResourceGuard(
    user,
    'update',
    'grade::type',
    '/grade-types',
    {
      checkAfterLoad: true,
      loaded: !gradeTypeLoading && !!gradeType,
    }
  );

  // All hooks must be called before any early returns
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    is_active: true,
    order: "0",
    weight: "1",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (gradeType) {
      setFormData({
        name: gradeType.name || "",
        code: gradeType.code || "",
        description: gradeType.description || "",
        is_active: gradeType.is_active ?? true,
        order: (gradeType.order || 0).toString(),
        weight: (gradeType.weight ?? 1).toString(),
      });
    }
  }, [gradeType]);

  // Show loading while checking permission or loading data
  if (isChecking || gradeTypeLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="max-w-2xl rounded-lg bg-white p-6 dark:bg-gray-800 space-y-6">
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
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = "Vui lòng nhập tên loại điểm";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});

    const weightValue = parseFloat(formData.weight);
    const result = await updateGradeType(gradeTypeId, {
      name: formData.name.trim(),
      code: formData.code.trim() || undefined,
      description: formData.description.trim() || undefined,
      is_active: formData.is_active,
      order: parseInt(formData.order) || 0,
      weight: Number.isFinite(weightValue) ? weightValue : 1,
    });

    if (result.success) {
      success("Cập nhật loại điểm thành công!");
      router.push("/grade-types");
    } else {
      // Sử dụng utility function để extract errors
      const errors = extractFieldErrors(result);
      const errorMessage = extractErrorMessage(result, "Có lỗi xảy ra khi cập nhật loại điểm");

      setFieldErrors(errors);
      showError(errorMessage);
    }
  };

  if (gradeTypeError || (!gradeTypeLoading && !gradeType)) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
        <h3 className="font-medium mb-2">Lỗi tải dữ liệu</h3>
        <p>{gradeTypeError || "Không tìm thấy loại điểm"}</p>
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
          <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white truncate">Chỉnh sửa loại điểm</h1>
          <p className="text-dark-4 dark:text-dark-6 mt-1">
            Cập nhật thông tin loại điểm số
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl rounded-lg bg-white p-6 dark:bg-gray-800">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <InputGroup
              label="Tên loại điểm"
              name="name"
              type="text"
              value={formData.name}
              handleChange={handleChange}
              placeholder="VD: Điểm bài tập, Điểm kiểm tra, Điểm thi"
              required
              error={fieldErrors.name}
            />
          </div>

          <div>
            <InputGroup
              label="Mã loại (tùy chọn)"
              name="code"
              type="text"
              value={formData.code}
              handleChange={handleChange}
              placeholder="VD: HOMEWORK, QUIZ, EXAM"
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
              placeholder="Mô tả về loại điểm này..."
              className={cn(
                "w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-white",
                fieldErrors.description && "border-red-500 focus:border-red-500 dark:border-red-400 dark:focus:border-red-400"
              )}
            />
            {fieldErrors.description && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.description}</p>
            )}
          </div>

          <InputGroup
            label="Trọng số / Hệ số"
            name="weight"
            type="number"
            value={formData.weight}
            handleChange={handleChange}
            placeholder="1"
            min="0"
            step="0.1"
            helperText="Dùng để tính điểm trung bình có trọng số. Mặc định là 1."
            error={fieldErrors.weight}
          />

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
            label="Kích hoạt loại điểm này"
          />

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 sm:gap-4 pt-4">
            <ButtonLink
              href="/grade-types"
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
  );
}

