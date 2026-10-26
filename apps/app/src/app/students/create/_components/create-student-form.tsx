"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCreateStudent } from "@/hooks/use-api";
import { useNotification } from "@/hooks/use-notification";
import InputGroup from "@/components/FormElements/InputGroup";
import { UserIcon, EmailIcon } from "@/assets/icons";
import { PhoneIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import Button from "@/components/Common/Button";
import ButtonLink from "@/components/Common/ButtonLink";

export function CreateStudentForm() {
  const router = useRouter();
  const notification = useNotification();
  const { mutate: createStudent, loading } = useCreateStudent();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    password_confirmation: "",
    student_code: "",
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      errors.name = "Vui lòng nhập tên học viên";
    }
    if (!formData.password) {
      errors.password = "Vui lòng nhập mật khẩu";
    } else if (formData.password.length < 8) {
      errors.password = "Mật khẩu phải có ít nhất 8 ký tự";
    }
    if (formData.password !== formData.password_confirmation) {
      errors.password_confirmation = "Mật khẩu xác nhận không khớp";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    // Clear previous errors
    setFieldErrors({});

    const result = await createStudent({
      name: formData.name,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      password: formData.password || undefined,
      password_confirmation: formData.password_confirmation || undefined,
      student_code: formData.student_code || undefined,
    });

    if (result.success) {
      notification.success("Thêm học viên thành công");
      router.push('/students');
    } else {
      if (result.errors && typeof result.errors === 'object') {
        // Handle API validation errors
        const apiErrors: Record<string, string> = {};
        Object.entries(result.errors).forEach(([key, value]) => {
          if (Array.isArray(value) && value.length > 0) {
            apiErrors[key] = value[0];
          }
        });
        setFieldErrors(apiErrors);
      }

      const message = result.message || "Có lỗi xảy ra";
      notification.error(message);
    }
  };

  return (
    <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
      <form onSubmit={handleSubmit} className="space-y-6">
        <InputGroup
          type="text"
          label="Tên học viên"
          placeholder="Nhập tên học viên"
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
            label="Địa chỉ Email"
            placeholder="Nhập địa chỉ email (tùy chọn)"
            name="email"
            value={formData.email}
            handleChange={handleChange}
            icon={<EmailIcon />}
            error={fieldErrors.email}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Email phải là duy nhất (không được trùng với học viên khác)
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputGroup
            type="password"
            label="Mật khẩu đăng nhập"
            placeholder="Tối thiểu 8 ký tự"
            name="password"
            value={formData.password}
            handleChange={handleChange}
            required
            error={fieldErrors.password}
          />
          <InputGroup
            type="password"
            label="Nhập lại mật khẩu"
            placeholder="Xác nhận mật khẩu"
            name="password_confirmation"
            value={formData.password_confirmation}
            handleChange={handleChange}
            required
            error={fieldErrors.password_confirmation}
          />
        </div>

        <InputGroup
          type="text"
          label="Mã học viên"
          placeholder="VD: HV2024001 (Để trống để tự động sinh mã)"
          name="student_code"
          value={formData.student_code}
          handleChange={handleChange}
          error={fieldErrors.student_code}
          helperText="Mã quản lý nội bộ. Nếu để trống, hệ thống sẽ tự động tạo theo quy tắc HV[Năm][Số]."
        />

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

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 sm:gap-4">
          <ButtonLink
            href="/students"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto justify-center"
          >
            Hủy
          </ButtonLink>

          <Button
            type="submit"
            disabled={loading}
            loading={loading}
            size="sm"
            variant="primary"
            icon={<CheckCircleIcon />}
            className="w-full sm:w-auto justify-center"
          >
            <span className="sm:hidden">Thêm</span>
            <span className="hidden sm:inline">Thêm học viên</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
