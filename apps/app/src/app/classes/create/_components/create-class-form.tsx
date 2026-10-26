"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCreateClass, useSubjects } from "@/hooks/use-api";
import { getObjId, idsEqual } from "@/lib/id-utils";
import { useAuthContext } from "@/contexts/auth-context";
import InputGroup from "@/components/FormElements/InputGroup";
import SelectInput from "@/components/FormElements/SelectInput";
import DateInput from "@/components/FormElements/DateInput";
import { UserIcon } from "@/assets/icons";
import { CheckCircleIcon, CalendarIcon, CurrencyDollarIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { useNotification } from "@/hooks/use-notification";
import { extractErrorMessage, extractFieldErrors } from "@/lib/api-error-utils";
import { formatAmount, parseAmount } from "@/lib/format-currency";
import Button from "@/components/Common/Button";

export function CreateClassForm() {
  const router = useRouter();
  const { mutate: createClass, loading } = useCreateClass();
  const { user } = useAuthContext();
  const { success, error: showError } = useNotification();
  const { data: subjects } = useSubjects(undefined);

  // In tutor-only system, all tutors can create classes
  // Backend will automatically set tutor_id to current user

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    subject_id: "",
    start_date: "",
    end_date: "",
    tuition_fee: "",
    max_students: "",
    class_code: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
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
      errors.name = "Vui lòng nhập tên lớp học";
    }

    if (!formData.subject_id) {
      errors.subject_id = "Vui lòng chọn môn học";
    }

    if (!formData.start_date) {
      errors.start_date = "Vui lòng chọn ngày bắt đầu";
    }

    if (!formData.max_students) {
      errors.max_students = "Vui lòng nhập số học viên tối đa";
    }

    // Validate max_students (no plan-based cap in single-tenant mode)
    let maxStudentsValue: number | null = null;

    if (formData.max_students) {
      maxStudentsValue = parseInt(formData.max_students);
      if (isNaN(maxStudentsValue) || maxStudentsValue <= 0) {
        errors.max_students = "Số học viên tối đa phải là số nguyên dương";
      }
    }

    // Validate end_date must be after start_date
    if (formData.end_date && formData.start_date) {
      const startDate = new Date(formData.start_date);
      const endDate = new Date(formData.end_date);
      if (endDate < startDate) {
        errors.end_date = "Ngày kết thúc phải sau ngày bắt đầu";
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});

    // Tìm subject name từ danh sách subjects
    const subjectsList = Array.isArray(subjects) ? subjects : (subjects?.data || []);
    const selectedSubject = subjectsList.find((s: any) => idsEqual(s, formData.subject_id));
    const subjectName = selectedSubject?.name || "";

    // Parse tuition fee
    const tuitionFee = formData.tuition_fee ? parseAmount(formData.tuition_fee) : undefined;

    // Build payload - backend will automatically set tutor_id to current user
    const payload: any = {
      name: formData.name,
      description: formData.description || undefined,
      subject: subjectName,
      subject_id: formData.subject_id ? formData.subject_id : undefined,
      start_date: formData.start_date,
      end_date: formData.end_date || undefined,
      tuition_fee: tuitionFee,
      max_students: maxStudentsValue,
      class_code: formData.class_code || undefined,
    };

    const result = await createClass(payload);

    if (result.success) {
      success("Tạo lớp học thành công!");
      router.push('/classes');
    } else {
      // Sử dụng utility function để extract errors
      const errors = extractFieldErrors(result);
      const errorMessage = extractErrorMessage(result, "Có lỗi xảy ra khi tạo lớp học");

      setFieldErrors(errors);
      showError(errorMessage);
    }
  };


  return (
    <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <InputGroup
            type="text"
            label="Tên lớp học"
            placeholder="Nhập tên lớp học"
            name="name"
            value={formData.name}
            handleChange={handleChange}
            icon={<UserIcon />}
            required
            error={fieldErrors.name}
          />
        </div>

        <InputGroup
          type="text"
          label="Mã lớp học"
          placeholder="VD: CLS-TOAN12 (Để trống để tự động sinh mã)"
          name="class_code"
          value={formData.class_code}
          handleChange={handleChange}
          error={fieldErrors.class_code}
          helperText="Mã quản lý lớp học. Nếu để trống, hệ thống sẽ tự động tạo theo quy tắc CLS-[Năm]-[Số]."
        />

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
            Mô tả
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Nhập mô tả lớp học (tùy chọn)"
            rows={4}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-primary"
          />
        </div>

        {/* Subject selection */}
        <div>
          <SelectInput
            label="Môn học"
            name="subject_id"
            value={formData.subject_id}
            onChange={handleChange}
            options={[
              { value: "", label: "-- Chọn môn học --" },
              ...(Array.isArray(subjects)
                ? subjects.map((subject: any) => {
                  const subjectId = getObjId(subject);
                  return {
                    value: subjectId,
                    label: `${subject.name}${subject.code ? ` (${subject.code})` : ''}`,
                  };
                })
                : subjects?.data?.map((subject: any) => {
                  const subjectId = getObjId(subject);
                  return {
                    value: subjectId,
                    label: `${subject.name}${subject.code ? ` (${subject.code})` : ''}`,
                  };
                }) || []),
            ]}
            required
            error={fieldErrors.subject_id || fieldErrors.subject}
          />
        </div>

        {/* Date Fields - 2 columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Start Date */}
          <div>
            <DateInput
              label="Ngày bắt đầu"
              name="start_date"
              value={formData.start_date}
              handleChange={handleChange}
              placeholder="Chọn ngày bắt đầu"
              icon={<CalendarIcon />}
              required
              error={fieldErrors.start_date}
            />
          </div>

          {/* End Date */}
          <div>
            <DateInput
              label="Ngày kết thúc dự kiến"
              name="end_date"
              value={formData.end_date}
              handleChange={handleChange}
              placeholder="Chọn ngày kết thúc (tùy chọn)"
              min={formData.start_date || undefined}
              icon={<CalendarIcon />}
              error={fieldErrors.end_date}
            />
          </div>
        </div>

        {/* Tuition Fee */}
        <InputGroup
          type="text"
          label="Học phí/tháng"
          placeholder="Nhập học phí (ví dụ: 500000)"
          name="tuition_fee"
          value={formData.tuition_fee}
          handleChange={(e) => {
            const formatted = formatAmount(e.target.value);
            setFormData(prev => ({ ...prev, tuition_fee: formatted }));
            if (fieldErrors.tuition_fee) {
              setFieldErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.tuition_fee;
                return newErrors;
              });
            }
          }}
          icon={<CurrencyDollarIcon />}
          helperText="Để trống nếu là lớp học miễn phí."
          error={fieldErrors.tuition_fee}
        />

        {/* Max Students */}
        <InputGroup
          type="number"
          label="Số học viên tối đa"
          placeholder="Ví dụ: 50"
          name="max_students"
          value={formData.max_students}
          handleChange={handleChange}
          icon={<UserGroupIcon />}
          required
          min="1"
          error={fieldErrors.max_students}
          helperText="Số học viên tối đa của lớp (do trung tâm quyết định)"
        />

        {/* Tutor info - In tutor-only system, tutor is always the current user */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
            Giáo viên quản lý
          </label>
          <div className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">
            {user?.name || 'Bạn'} (Tự động gán)
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Lớp học sẽ tự động được gán cho bạn (tutor-only system)
          </p>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 sm:gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            type="button"
            onClick={() => router.back()}
            variant="outline"
            size="sm"
            className="w-full sm:w-auto justify-center"
          >
            Hủy
          </Button>
          <Button
            type="submit"
            disabled={loading}
            loading={loading}
            size="sm"
            variant="primary"
            icon={<CheckCircleIcon />}
            className="w-full sm:w-auto justify-center"
          >
            <span className="sm:hidden">Tạo</span>
            <span className="hidden sm:inline">Tạo lớp học</span>
          </Button>
        </div>
      </form>
    </div>
  );
}