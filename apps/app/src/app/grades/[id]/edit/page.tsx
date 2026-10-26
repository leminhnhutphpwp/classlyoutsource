"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import InputGroup from "@/components/FormElements/InputGroup";
import DateInput from "@/components/FormElements/DateInput";
import SelectInput from "@/components/FormElements/SelectInput";
import { useGrade, useUpdateGrade, useClasses, useClassStudents, useClassAssignments, useGradeTypes } from "@/hooks/use-api";
import { useAuthContext } from "@/contexts/auth-context";
import { useResourceGuard } from "@/lib/permission-guards";
import { useGoBack } from "@/hooks/use-go-back";
import { ArrowLeftIcon, DocumentTextIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { useNotification } from "@/hooks/use-notification";
import Button from "@/components/Common/Button";
import ButtonLink from "@/components/Common/ButtonLink";
import { formatGradeTypeLabel } from "@/utils/grade-types";
import { cn } from "@/lib/utils";
import { extractErrorMessage, extractFieldErrors } from "@/lib/api-error-utils";
import { getObjId, idsEqual } from "@/lib/id-utils";

export default function EditGradePage() {
  const params = useParams();
  const router = useRouter();
  const gradeId = params.id as string;
  const { user } = useAuthContext();
  const handleGoBack = useGoBack(`/grades/${gradeId}`);

  // All hooks must be called before any early returns
  const { data: grade, loading: gradeLoading, error: gradeError, permissions } = useGrade(gradeId);
  const { mutate: updateGrade, loading: updateLoading } = useUpdateGrade();
  const { success, error: showError } = useNotification();

  // Use resource guard to protect this route (check after grade loads)
  const { hasAccess, isChecking } = useResourceGuard(
    user,
    'update',
    'grade',
    '/grades',
    {
      checkAfterLoad: true,
      loaded: !gradeLoading && !!grade,
    }
  );

  // All other hooks must be called before any early returns
  const { data: classes, loading: classesLoading } = useClasses();
  const { data: gradeTypes, loading: gradeTypesLoading } = useGradeTypes({ is_active: true });

  // Use formData.class_id for dynamic fetching, fallback to grade.class_id on initial load
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const { data: students, loading: studentsLoading } = useClassStudents(selectedClassId || grade?.class_id?.toString());
  const { data: assignments, loading: assignmentsLoading } = useClassAssignments(selectedClassId || grade?.class_id?.toString());

  const [formData, setFormData] = useState({
    title: "",
    class_id: "",
    student_id: "",
    assignment_id: "",
    grade_type_id: "",
    score: "",
    max_score: "100",
    comments: "",
    grade_date: "",
    semester: "",
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (grade) {
      setFormData({
        title: grade.title || "",
        class_id: (grade.class_id || "").toString(),
        student_id: (grade.student_id || "").toString(),
        assignment_id: (grade.assignment_id || "").toString(),
        grade_type_id: (grade.grade_type_id || "").toString(),
        score: (grade.score || grade.grade || "").toString(),
        max_score: (grade.max_score || grade.max_points || 100).toString(),
        comments: grade.comments || grade.notes || "",
        grade_date: grade.grade_date ? new Date(grade.grade_date).toISOString().split("T")[0] : "",
        semester: grade.semester || "",
      });
    }
  }, [grade]);

  // Update selectedClassId when formData.class_id changes
  useEffect(() => {
    setSelectedClassId(formData.class_id);
  }, [formData.class_id]);

  // Reset students and assignments when class_id changes
  useEffect(() => {
    if (formData.class_id && !idsEqual(grade?.class_id, formData.class_id)) {
      setFormData(prev => ({
        ...prev,
        student_id: "",
        assignment_id: "",
      }));
    }
  }, [formData.class_id, grade?.class_id]);

  // Check permissions from API response
  const canManageFromApi = permissions?.can_manage ?? false;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
    if (!formData.title.trim()) errors.title = "Vui lòng nhập tiêu đề";
    if (!formData.class_id) errors.class_id = "Vui lòng chọn lớp học";
    if (!formData.student_id) errors.student_id = "Vui lòng chọn học viên";
    if (!formData.score) errors.score = "Vui lòng nhập điểm số";
    if (!formData.grade_date) errors.grade_date = "Vui lòng chọn ngày chấm";

    const score = parseFloat(formData.score);
    const maxScore = parseFloat(formData.max_score || "100");

    if (!isNaN(score) && (score < 0 || score > maxScore)) {
      errors.score = `Điểm phải từ 0 đến ${maxScore}`;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});

    const result = await updateGrade(gradeId, {
      title: formData.title,
      class_id: formData.class_id,
      student_id: formData.student_id,
      assignment_id: formData.assignment_id ? formData.assignment_id : undefined,
      grade_type_id: formData.grade_type_id ? formData.grade_type_id : undefined,
      score: score,
      max_score: maxScore,
      comments: formData.comments || undefined,
      grade_date: formData.grade_date || undefined,
      semester: formData.semester || undefined,
    });

    if (result.success) {
      success("Cập nhật điểm số thành công");
      setTimeout(() => {
        router.push(`/grades/${gradeId}`);
      }, 500);
    } else {
      const apiErrors = extractFieldErrors(result);
      const errorMessage = extractErrorMessage(result, "Có lỗi xảy ra khi cập nhật điểm số");
      setFieldErrors(apiErrors);
      showError(errorMessage);
    }
  };

  // Show loading skeleton while loading or checking permissions
  if (gradeLoading || classesLoading || gradeTypesLoading || isChecking) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="h-10 w-full sm:w-24 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="flex-1 min-w-0">
            <div className="h-6 sm:h-8 w-full sm:w-64 rounded bg-gray-200 dark:bg-gray-700 animate-pulse mb-2" />
            <div className="h-4 w-full sm:w-48 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
          </div>
        </div>

        {/* Form Skeleton */}
        <div className="max-w-2xl rounded-lg bg-white p-6 dark:bg-gray-800">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-12 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-12 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-12 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-12 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
              <div className="md:col-span-2 space-y-2">
                <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-12 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
              <div className="md:col-span-2 grid grid-cols-2 gap-4">
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
                <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-12 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-12 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
              <div className="md:col-span-2 space-y-2">
                <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-24 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 sm:gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="h-10 w-full sm:w-20 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-10 w-full sm:w-32 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (gradeError || !grade) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
        <h3 className="font-medium mb-2">Lỗi tải dữ liệu</h3>
        <p>{gradeError || "Không tìm thấy điểm số"}</p>
      </div>
    );
  }

  // Check permissions from API response
  // Only check canManageFromApi if permissions exists (API returned permissions)
  // If permissions is undefined, rely only on hasAccess from useResourceGuard
  if (!hasAccess || (permissions !== undefined && !canManageFromApi)) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <Button
          onClick={handleGoBack}
          variant="outline"
          size="sm"
          icon={<ArrowLeftIcon />}
          className="w-full sm:w-auto"
        >
          Quay lại
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white truncate">Chỉnh sửa điểm số</h1>
          <p className="text-sm sm:text-base text-dark-4 dark:text-dark-6 mt-1 break-words">
            {grade?.title || grade?.assignment?.title || "Cập nhật thông tin điểm số"}
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-2xl rounded-lg bg-white p-6 dark:bg-gray-800 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputGroup
            label="Tiêu đề"
            name="title"
            type="text"
            value={formData.title}
            handleChange={handleChange}
            placeholder="Nhập tiêu đề điểm số"
            icon={<DocumentTextIcon />}
            required
            error={fieldErrors.title}
          />

          <SelectInput
            label="Lớp học"
            name="class_id"
            value={formData.class_id}
            handleChange={handleChange}
            required
            placeholder={classesLoading ? "Đang tải lớp học..." : "-- Chọn lớp học --"}
            error={fieldErrors.class_id}
            options={
              classesLoading
                ? []
                : (classes || []).map((classItem: any) => ({
                  value: getObjId(classItem),
                  label: classItem.name,
                }))
            }
          />

          <SelectInput
            label="Học viên"
            name="student_id"
            value={formData.student_id}
            handleChange={handleChange}
            required
            disabled={!formData.class_id}
            error={fieldErrors.student_id}
            placeholder={
              !formData.class_id
                ? "-- Chọn lớp học trước --"
                : studentsLoading
                  ? "Đang tải học viên..."
                  : "-- Chọn học viên --"
            }
            options={
              !formData.class_id || studentsLoading
                ? []
                : (students || []).map((student: any) => {
                  const isPaused = student.enrollment?.is_paused;
                  return {
                    value: getObjId(student),
                    label: isPaused ? `${student.name} (Tạm dừng học)` : student.name,
                    disabled: isPaused,
                  };
                })
            }
          />

          <SelectInput
            label="Bài tập (tùy chọn)"
            name="assignment_id"
            value={formData.assignment_id}
            handleChange={handleChange}
            disabled={!formData.class_id}
            error={fieldErrors.assignment_id}
            placeholder={
              !formData.class_id
                ? "Chọn lớp để xem bài tập"
                : assignmentsLoading
                  ? "Đang tải bài tập..."
                  : "-- Không có bài tập --"
            }
            options={
              !formData.class_id || assignmentsLoading
                ? []
                : (assignments || []).map((assignment: any) => ({
                  value: getObjId(assignment),
                  label: assignment.title,
                }))
            }
          />

          <div className="md:col-span-2">
            <SelectInput
              label="Loại điểm"
              name="grade_type_id"
              value={formData.grade_type_id}
              handleChange={handleChange}
              error={fieldErrors.grade_type_id}
              placeholder={
                gradeTypesLoading
                  ? "Đang tải loại điểm..."
                  : "-- Chọn loại điểm (tùy chọn) --"
              }
              options={
                gradeTypesLoading
                  ? []
                  : (gradeTypes || []).map((gradeType: any) => ({
                    value: getObjId(gradeType),
                    label: formatGradeTypeLabel(gradeType),
                  }))
              }
            />
          </div>

          <div className="md:col-span-2 grid grid-cols-2 gap-4">
            <InputGroup
              label="Điểm số"
              name="score"
              type="number"
              value={formData.score}
              handleChange={handleChange}
              placeholder="0"
              required
              step="0.1"
              min="0"
              error={fieldErrors.score}
            />

            <InputGroup
              label="Điểm tối đa"
              name="max_score"
              type="number"
              value={formData.max_score}
              handleChange={handleChange}
              placeholder="100"
              required
              step="0.1"
              min="1"
              error={fieldErrors.max_score}
            />
          </div>

          <DateInput
            label="Ngày chấm"
            placeholder="Chọn ngày"
            name="grade_date"
            value={formData.grade_date}
            onChange={handleChange}
            required
            error={fieldErrors.grade_date}
          />

          <InputGroup
            label="Học kỳ"
            name="semester"
            type="text"
            value={formData.semester}
            handleChange={handleChange}
            placeholder="VD: Học kỳ 1, Học kỳ 2"
            error={fieldErrors.semester}
          />

          <div className="md:col-span-2">
            <label htmlFor="comments" className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
              Ghi chú
            </label>
            <textarea
              id="comments"
              name="comments"
              value={formData.comments}
              onChange={handleChange}
              rows={4}
              className={cn(
                "w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-primary",
                fieldErrors.comments && "border-red-500 focus:border-red-500 dark:border-red-400 dark:focus:border-red-400"
              )}
              placeholder="Nhập ghi chú hoặc nhận xét (tùy chọn)"
            />
            {fieldErrors.comments && (
              <p className="mt-1 text-sm text-red-500 dark:text-red-400">
                {fieldErrors.comments}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 sm:gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <ButtonLink
            href={`/grades/${gradeId}`}
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
            <span className="sm:hidden">Lưu</span>
            <span className="hidden sm:inline">Lưu thay đổi</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
