"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useClassDetails, useUpdateClass, useSubjects, useClassStudents } from "@/hooks/use-api";
import { getObjId, idsEqual } from "@/lib/id-utils";
import { useGoBack } from "@/hooks/use-go-back";
import { useAuthContext } from "@/contexts/auth-context";
import InputGroup from "@/components/FormElements/InputGroup";
import SelectInput from "@/components/FormElements/SelectInput";
import RichTextEditor from "@/components/FormElements/RichTextEditorDynamic";
import DateInput from "@/components/FormElements/DateInput";
import { UserIcon, ArrowLeftIcon, CheckCircleIcon, ExclamationTriangleIcon, CalendarIcon, CurrencyDollarIcon } from "@heroicons/react/24/outline";
import { useResourceGuard } from "@/lib/permission-guards";
import { useNotification } from "@/hooks/use-notification";
import { extractErrorMessage, extractFieldErrors } from "@/lib/api-error-utils";
import { formatAmount, parseAmount } from "@/lib/format-currency";
import Button from "@/components/Common/Button";
import ButtonLink from "@/components/Common/ButtonLink";

export default function EditClassPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.id as string;
  const { user } = useAuthContext();
  const handleGoBack = useGoBack(`/classes/${classId}`);

  // All hooks must be called before any early returns
  const { data: classDetails, loading: classLoading, error: classError, permissions } = useClassDetails(classId);

  // Use resource guard to protect this route (check after class loads)
  const { hasAccess, isChecking } = useResourceGuard(
    user,
    'update',
    'class::room',
    `/classes/${classId}`,
    {
      checkAfterLoad: true,
      loaded: !classLoading && !!classDetails,
    }
  );
  const { mutate: updateClass, loading: updateLoading } = useUpdateClass();
  const { success, error: showError } = useNotification();
  const { data: subjects, loading: subjectsLoading } = useSubjects(undefined);
  const { statistics: studentsStats } = useClassStudents(classId);

  // Check permissions from API response
  const canManageFromApi = permissions?.can_manage ?? false;

  // All useState hooks must be called before any early returns
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    status: "active",
    subject_id: "",
    start_date: "",
    end_date: "",
    tuition_fee: "",
    max_students: "",
    class_code: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [originalStartDate, setOriginalStartDate] = useState<string>("");
  const [showDateWarning, setShowDateWarning] = useState(false);

  // Load class details vào form
  useEffect(() => {
    if (classDetails) {
      // Đảm bảo format date đúng (Y-m-d) - parse từ nhiều format có thể
      const parseDate = (dateStr: string | null | undefined): string => {
        if (!dateStr) return "";

        // Nếu đã là format Y-m-d (yyyy-mm-dd)
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          return dateStr;
        }

        // Nếu có T (ISO format), lấy phần date
        if (dateStr.includes('T')) {
          return dateStr.split('T')[0];
        }

        // Thử parse và format lại
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }

        return dateStr; // Trả về nguyên bản nếu không parse được
      };

      const startDate = parseDate(classDetails.start_date);
      const endDate = parseDate(classDetails.end_date);

      setFormData(prev => ({
        name: classDetails.name || "",
        description: classDetails.description || "",
        status: classDetails.status || "active",
        subject_id: getObjId(classDetails.subject_id),
        start_date: startDate,
        end_date: endDate,
        tuition_fee: classDetails.tuition_fee ? formatAmount(classDetails.tuition_fee) : "",
        max_students: classDetails.max_students ? String(classDetails.max_students) : prev.max_students,
        class_code: classDetails.class_code || "",
      }));
      setOriginalStartDate(startDate);
    }
  }, [classDetails]);

  // Consolidate loading state - check loading FIRST before permission checks
  const isLoading = classLoading || subjectsLoading || isChecking;

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
              <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-24 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-28 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-12 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-12 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="flex items-center gap-4">
              <div className="h-12 w-32 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-12 w-20 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Check error AFTER loading is done
  if (classError || (!classLoading && !classDetails)) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
        <h3 className="font-medium mb-2">Lỗi tải dữ liệu</h3>
        <p>{classError || "Không tìm thấy lớp học"}</p>
      </div>
    );
  }

  // Show nothing while checking permissions or redirecting (only after loading is done)
  if (!isLoading && (!hasAccess || (classDetails && permissions !== undefined && !canManageFromApi))) {
    return null;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    // Format amount for tuition_fee
    if (name === "tuition_fee") {
      const formatted = formatAmount(value);
      setFormData(prev => ({
        ...prev,
        [name]: formatted
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }

    // Check if start_date or end_date changed and show warning
    if (name === "start_date" || name === "end_date") {
      if (name === "start_date" && value !== originalStartDate && originalStartDate) {
        setShowDateWarning(true);
      } else if (name === "start_date" && value === originalStartDate) {
        setShowDateWarning(false);
      }
    }

    // Xóa lỗi của field khi user bắt đầu nhập lại
    if (fieldErrors[name]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleRichTextChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      description: value
    }));
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

    if (!errors.max_students && maxStudentsValue !== null) {
      // Validate không được giảm max_students xuống dưới số học viên hiện tại
      const currentActiveCount = studentsStats?.active_count || classDetails?.active_student_count || 0;
      if (maxStudentsValue < currentActiveCount) {
        errors.max_students = `Không thể giảm xuống dưới ${currentActiveCount} học viên hiện tại`;
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
    const subjectName = selectedSubject?.name || classDetails?.subject || "";

    // Build payload based on user type
    const finalMaxStudents = maxStudentsValue !== null ? maxStudentsValue : undefined;

    const payload: any = {
      name: formData.name,
      description: formData.description || undefined,
      status: formData.status,
      subject: subjectName,
      subject_id: formData.subject_id ? formData.subject_id : undefined,
      start_date: formData.start_date,
      end_date: formData.end_date || undefined,
      tuition_fee: formData.tuition_fee ? (parseAmount(formData.tuition_fee) || undefined) : undefined,
      max_students: finalMaxStudents,
      class_code: formData.class_code || undefined,
    };

    // In tutor-only system, tutor_id is automatically set to current user by backend
    // Don't send tutor_id - backend will use authenticated user's ID

    const result = await updateClass(classId, payload);

    if (result.success) {
      success("Cập nhật lớp học thành công");
      setTimeout(() => {
        router.push(`/classes/${classId}`);
      }, 500);
    } else {
      // Sử dụng utility function để extract errors
      const errors = extractFieldErrors(result);
      const errorMessage = extractErrorMessage(result, "Có lỗi xảy ra khi cập nhật lớp học");

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

        <div className="flex-1">
          <h1 className="text-2xl font-bold text-dark dark:text-white">Chỉnh sửa lớp học</h1>
          <p className="text-dark-4 dark:text-dark-6 mt-1">
            Cập nhật thông tin lớp học &quot;{classDetails.name}&quot;
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-2xl rounded-lg bg-white p-6 dark:bg-gray-800 space-y-6">
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
          placeholder="VD: CLS-TOAN12"
          name="class_code"
          value={formData.class_code}
          handleChange={handleChange}
          error={fieldErrors.class_code}
          helperText="Mã quản lý lớp học."
        />

        <RichTextEditor
          label="Mô tả"
          value={formData.description}
          onChange={handleRichTextChange}
          placeholder="Nhập mô tả lớp học (tùy chọn)"
          error={fieldErrors.description}
        />

        {/* Subject selection */}
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

        {/* Date Warning */}
        {showDateWarning && (
          <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4 dark:bg-yellow-900/20 dark:border-yellow-800">
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-1">
                  Cảnh báo: Thay đổi ngày bắt đầu
                </h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-400">
                  Việc thay đổi ngày bắt đầu của lớp học có thể ảnh hưởng đến lịch học đã được tạo.
                  Vui lòng kiểm tra và cập nhật lại lịch học nếu cần thiết.
                </p>
              </div>
            </div>
          </div>
        )}

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
              error={fieldErrors.start_date}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              <span className="text-red-500">*</span> Bắt buộc
            </p>
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
          handleChange={handleChange}
          icon={<CurrencyDollarIcon />}
          error={fieldErrors.tuition_fee}
        />

        {/* Max Students */}
        <div>
          <InputGroup
            type="number"
            label="Số học viên tối đa"
            placeholder="Nhập số học viên tối đa"
            name="max_students"
            value={formData.max_students}
            handleChange={handleChange}
            required
            min="1"
            error={fieldErrors.max_students}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Số học viên tối đa của lớp (do trung tâm quyết định)
          </p>
          {fieldErrors.max_students && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.max_students}</p>
          )}
        </div>

        {/* Tutor info - In tutor-only system, tutor is always the current user */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
            Giáo viên
          </label>
          <div className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">
            {classDetails?.tutor?.name || user?.name || 'N/A'}
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Lớp học này thuộc về bạn (tutor-only system)
          </p>
        </div>

        <SelectInput
          label="Trạng thái"
          name="status"
          value={formData.status}
          onChange={handleChange}
          options={[
            { value: "active", label: "Đang dạy" },
            { value: "inactive", label: "Tạm dừng" },
          ]}
        />

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 sm:gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <ButtonLink
            href={`/classes/${classId}`}
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
            <span className="sm:hidden">Cập nhật</span>
            <span className="hidden sm:inline">Cập nhật lớp học</span>
          </Button>
        </div>
      </form>
    </div>
  );
}

