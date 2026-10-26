"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import InputGroup from "@/components/FormElements/InputGroup";
import DateInput from "@/components/FormElements/DateInput";
import SelectInput from "@/components/FormElements/SelectInput";
import { useCreateGrade, useClasses, useClassStudents, useClassAssignments, useGradeTypes } from "@/hooks/use-api";
import { useGoBack } from "@/hooks/use-go-back";
import { useAuthContext } from "@/contexts/auth-context";
import { useResourceGuard } from "@/lib/permission-guards";
import { ArrowLeftIcon, DocumentTextIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { useNotification } from "@/hooks/use-notification";
import Button from "@/components/Common/Button";
import ButtonLink from "@/components/Common/ButtonLink";
import { formatGradeTypeLabel } from "@/utils/grade-types";
import { getObjId, idsEqual } from "@/lib/id-utils";

export default function CreateGradePage() {
  const router = useRouter();
  const { user } = useAuthContext();
  const handleGoBack = useGoBack('/grades');

  // Use resource guard to protect this route
  useResourceGuard(
    user,
    'create',
    'grade',
    '/403'
  );

  // All hooks must be called before any early returns
  const { mutate: createGrade, loading: createLoading, error: createError } = useCreateGrade();
  const { success, error: showError } = useNotification();
  const { data: classes, loading: classesLoading } = useClasses();
  const { data: gradeTypes, loading: gradeTypesLoading } = useGradeTypes({ is_active: true });

  const [mode, setMode] = useState<"single" | "bulk">("single");

  // Common state
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const { data: students, loading: studentsLoading } = useClassStudents(selectedClassId);
  const { data: assignments, loading: assignmentsLoading } = useClassAssignments(selectedClassId);

  // Single mode form
  const [formData, setFormData] = useState({
    title: "",
    class_id: "",
    student_id: "",
    assignment_id: "",
    grade_type_id: "",
    score: "",
    max_score: "100",
    comments: "",
    grade_date: new Date().toISOString().split("T")[0],
    semester: "",
  });

  // Bulk mode form
  type GradeEntry = {
    student_id: string;
    score: string;
    comments: string;
  };

  const [bulkConfig, setBulkConfig] = useState({
    title: "",
    class_id: "",
    assignment_id: "",
    grade_type_id: "",
    max_score: "100",
    grade_date: new Date().toISOString().split("T")[0],
    semester: "",
    entries: [] as GradeEntry[],
  });

  // Update selectedClassId when class_id changes (handles both modes)
  useEffect(() => {
    if (mode === "single") {
      setSelectedClassId(formData.class_id);
    } else {
      setSelectedClassId(bulkConfig.class_id);
    }
  }, [formData.class_id, bulkConfig.class_id, mode]);

  // Reset dependent fields when class_id changes
  useEffect(() => {
    if (mode === "single" && formData.class_id) {
      setFormData(prev => ({ ...prev, student_id: "", assignment_id: "" }));
    } else if (mode === "bulk" && bulkConfig.class_id) {
      setBulkConfig(prev => ({ ...prev, assignment_id: "", entries: [] }));
    }
  }, [formData.class_id, bulkConfig.class_id, mode]);

  // Initialize bulk entries when students match class
  useEffect(() => {
    if (mode === "bulk" && students && students.length > 0) {
      const entries = students.map((s: any) => ({
        student_id: getObjId(s),
        score: "",
        comments: ""
      }));
      setBulkConfig(prev => ({ ...prev, entries }));
    }
  }, [students, mode]);

  // Handlers
  const handleSingleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    // Validate score <= max_score
    if (name === "score") {
      const max = parseFloat(formData.max_score || "100");
      const val = parseFloat(value);
      if (!isNaN(val) && val > max) return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBulkConfigChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setBulkConfig(prev => ({ ...prev, [name]: value }));
  };

  const handleBulkEntryChange = (index: number, field: keyof GradeEntry, value: string) => {
    // Validate score <= max_score
    if (field === "score") {
      const max = parseFloat(bulkConfig.max_score || "100");
      const val = parseFloat(value);
      if (!isNaN(val) && val > max) return;
    }

    setBulkConfig(prev => {
      const newEntries = [...prev.entries];
      newEntries[index] = { ...newEntries[index], [field]: value };
      return { ...prev, entries: newEntries };
    });
  };

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.class_id || !formData.student_id || !formData.title || !formData.score || !formData.grade_date) {
      showError("Vui lòng điền đầy đủ các trường bắt buộc");
      return;
    }

    const score = parseFloat(formData.score);
    const maxScore = parseFloat(formData.max_score || "100");

    if (isNaN(score) || score < 0 || score > maxScore) {
      showError(`Điểm phải từ 0 đến ${maxScore}`);
      return;
    }

    const result = await createGrade({
      title: formData.title,
      class_id: formData.class_id,
      student_id: formData.student_id,
      assignment_id: formData.assignment_id || undefined,
      grade_type_id: formData.grade_type_id || undefined,
      score: score,
      max_score: maxScore,
      comments: formData.comments || undefined,
      grade_date: formData.grade_date || undefined,
      semester: formData.semester || undefined,
    });

    if (result.success) {
      success("Tạo điểm số thành công");
      setTimeout(() => router.push("/grades"), 500);
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!bulkConfig.class_id || !bulkConfig.title || !bulkConfig.grade_date) {
      showError("Vui lòng điền thông tin chung bắt buộc");
      return;
    }

    // Filter entries with scores
    const validEntries = bulkConfig.entries.filter(e => e.score.trim() !== "");

    if (validEntries.length === 0) {
      showError("Vui lòng nhập điểm cho ít nhất một học viên");
      return;
    }

    const maxScore = parseFloat(bulkConfig.max_score || "100");

    // Create all grades
    let successCount = 0;
    let errorCount = 0;

    for (const entry of validEntries) {
      const score = parseFloat(entry.score);
      if (isNaN(score) || score < 0 || score > maxScore) {
        showError(`Điểm không hợp lệ cho học viên ID: ${entry.student_id}`);
        errorCount++;
        continue;
      }

      const result = await createGrade({
        title: bulkConfig.title,
        class_id: bulkConfig.class_id,
        student_id: entry.student_id,
        assignment_id: bulkConfig.assignment_id || undefined,
        grade_type_id: bulkConfig.grade_type_id || undefined,
        score: score,
        max_score: maxScore,
        comments: entry.comments || undefined,
        grade_date: bulkConfig.grade_date || undefined,
        semester: bulkConfig.semester || undefined,
      });

      if (result.success) successCount++;
      else errorCount++;
    }

    if (successCount > 0) {
      success(`Đã tạo thành công ${successCount} điểm số`);
      if (errorCount === 0) {
        setTimeout(() => router.push("/grades"), 500);
      }
    } else if (errorCount > 0) {
      showError("Có lỗi xảy ra khi tạo điểm số");
    }
  };

  const isLoading = classesLoading || gradeTypesLoading;

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
          <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white truncate">Tạo điểm số mới</h1>
          <p className="text-dark-4 dark:text-dark-6 mt-1 break-words">
            Thêm điểm số cho học viên
          </p>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex gap-4">
          <button
            onClick={() => setMode("single")}
            className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${mode === "single"
              ? "text-primary border-primary"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border-transparent"
              }`}
          >
            Tạo đơn lẻ
          </button>
          <button
            onClick={() => setMode("bulk")}
            className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${mode === "bulk"
              ? "text-primary border-primary"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border-transparent"
              }`}
          >
            Tạo theo lớp (Nhiều)
          </button>
        </nav>
      </div>

      {/* Form */}
      {isLoading ? (
        <div className="max-w-4xl rounded-lg bg-white p-6 dark:bg-gray-800">
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-12 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-12 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
          </div>
        </div>
      ) : (
        <>
          {mode === "single" ? (
            <form onSubmit={handleSingleSubmit} className="max-w-2xl rounded-lg bg-white p-6 dark:bg-gray-800 space-y-6">
              {createError && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                  {createError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputGroup
                  label="Tiêu đề"
                  name="title"
                  type="text"
                  value={formData.title}
                  handleChange={handleSingleChange}
                  placeholder="Nhập tiêu đề điểm số"
                  icon={<DocumentTextIcon />}
                  required
                />

                <SelectInput
                  label="Lớp học"
                  name="class_id"
                  value={formData.class_id}
                  handleChange={handleSingleChange}
                  required
                  placeholder={classesLoading ? "Đang tải lớp học..." : "-- Chọn lớp học --"}
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
                  handleChange={handleSingleChange}
                  required
                  disabled={!formData.class_id}
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
                  handleChange={handleSingleChange}
                  disabled={!formData.class_id}
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
                    handleChange={handleSingleChange}
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
                    handleChange={handleSingleChange}
                    placeholder="0"
                    required
                    step="0.1"
                    min="0"
                  />

                  <InputGroup
                    label="Điểm tối đa"
                    name="max_score"
                    type="number"
                    value={formData.max_score}
                    handleChange={handleSingleChange}
                    placeholder="100"
                    required
                    step="0.1"
                    min="1"
                  />
                </div>

                <DateInput
                  label="Ngày chấm"
                  placeholder="Chọn ngày"
                  name="grade_date"
                  value={formData.grade_date}
                  onChange={handleSingleChange}
                  required
                />

                <InputGroup
                  label="Học kỳ"
                  name="semester"
                  type="text"
                  value={formData.semester}
                  handleChange={handleSingleChange}
                  placeholder="VD: Học kỳ 1, Học kỳ 2"
                />

                <div className="md:col-span-2">
                  <label htmlFor="comments" className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                    Ghi chú
                  </label>
                  <textarea
                    id="comments"
                    name="comments"
                    value={formData.comments}
                    onChange={handleSingleChange}
                    rows={4}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-primary"
                    placeholder="Nhập ghi chú (tùy chọn)"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 sm:gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <ButtonLink
                  href="/grades"
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
                  <span className="hidden sm:inline">Tạo điểm số</span>
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleBulkSubmit} className="max-w-4xl rounded-lg bg-white p-6 dark:bg-gray-800 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                <h3 className="md:col-span-2 font-semibold text-gray-900 dark:text-white">Thông tin chung</h3>

                <SelectInput
                  label="Lớp học"
                  name="class_id"
                  value={bulkConfig.class_id}
                  handleChange={handleBulkConfigChange}
                  required
                  placeholder={classesLoading ? "Đang tải lớp học..." : "-- Chọn lớp học --"}
                  options={
                    classesLoading
                      ? []
                      : (classes || []).map((classItem: any) => ({
                        value: getObjId(classItem),
                        label: classItem.name,
                      }))
                  }
                />

                <InputGroup
                  label="Tiêu đề"
                  name="title"
                  type="text"
                  value={bulkConfig.title}
                  handleChange={handleBulkConfigChange}
                  placeholder="Nhập tiêu đề (VD: Kiểm tra 15p)"
                  icon={<DocumentTextIcon />}
                  required
                />

                <SelectInput
                  label="Bài tập (tùy chọn)"
                  name="assignment_id"
                  value={bulkConfig.assignment_id}
                  handleChange={handleBulkConfigChange}
                  disabled={!bulkConfig.class_id}
                  placeholder={
                    !bulkConfig.class_id
                      ? "Chọn lớp để xem bài tập"
                      : assignmentsLoading
                        ? "Đang tải bài tập..."
                        : "-- Không có bài tập --"
                  }
                  options={
                    !bulkConfig.class_id || assignmentsLoading
                      ? []
                      : (assignments || []).map((assignment: any) => ({
                        value: getObjId(assignment),
                        label: assignment.title,
                      }))
                  }
                />

                <SelectInput
                  label="Loại điểm"
                  name="grade_type_id"
                  value={bulkConfig.grade_type_id}
                  handleChange={handleBulkConfigChange}
                  placeholder="-- Chọn loại điểm --"
                  options={
                    (gradeTypes || []).map((gradeType: any) => ({
                      value: getObjId(gradeType),
                      label: formatGradeTypeLabel(gradeType),
                    }))
                  }
                />

                <InputGroup
                  label="Điểm tối đa"
                  name="max_score"
                  type="number"
                  value={bulkConfig.max_score}
                  handleChange={handleBulkConfigChange}
                  placeholder="100"
                  required
                />

                <DateInput
                  label="Ngày chấm"
                  placeholder="Chọn ngày"
                  name="grade_date"
                  value={bulkConfig.grade_date}
                  onChange={handleBulkConfigChange}
                  required
                />
              </div>

              {/* Student List */}
              {bulkConfig.class_id && (
                <div className="space-y-3">
                  <div className="flex justify-between items-end px-1">
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white text-base">Danh sách học viên ({bulkConfig.entries.length})</h3>
                      <p className="text-[11px] text-gray-500 mt-0.5">Nhập điểm cho từng học viên bên dưới</p>
                    </div>
                  </div>

                  {studentsLoading ? (
                    <div className="p-8 text-center text-gray-500">Đang tải danh sách học viên...</div>
                  ) : bulkConfig.entries.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      Lớp chưa có học viên nào
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {bulkConfig.entries.map((entry, index) => {
                        const student = students.find((s: any) => idsEqual(s, entry.student_id));
                        const isPaused = student?.enrollment?.is_paused;

                        return (
                          <div
                            key={entry.student_id}
                            className={`grid grid-cols-1 lg:grid-cols-12 gap-4 rounded-lg border p-4 items-center transition-colors ${isPaused
                              ? "bg-gray-50/50 border-gray-200 opacity-60 dark:bg-gray-900/20 dark:border-gray-700"
                              : "bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700"
                              }`}
                          >
                            {/* Student Info - Fixed width on large screens */}
                            <div className="lg:col-span-5 flex items-center gap-3 min-w-0">
                              <div className={`h-12 w-12 flex-shrink-0 rounded-full flex items-center justify-center ${isPaused
                                ? "bg-gray-200 dark:bg-gray-700"
                                : "bg-gray-200 dark:bg-gray-700"
                                }`}>
                                <span className={`text-lg font-semibold ${isPaused
                                  ? "text-gray-500 dark:text-gray-400"
                                  : "text-gray-700 dark:text-gray-300"
                                  }`}>
                                  {student?.name?.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-gray-900 dark:text-white truncate">
                                    {student?.name}
                                  </p>
                                  {isPaused && (
                                    <span className="text-xs font-medium text-red-600 bg-red-100 px-2 py-0.5 rounded-full dark:bg-red-900/20 dark:text-red-400">
                                      Tạm dừng
                                    </span>
                                  )}
                                </div>
                                {student?.email && (
                                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{student.email}</p>
                                )}
                              </div>
                            </div>

                            {/* Score Input - Fixed width */}
                            <div className="lg:col-span-3 flex items-center gap-2">
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                Điểm:
                              </label>
                              <InputGroup
                                type="number"
                                value={entry.score}
                                handleChange={(e) => handleBulkEntryChange(index, "score", e.target.value)}
                                placeholder="0"
                                min={0}
                                max={bulkConfig.max_score}
                                step="0.1"
                                disabled={isPaused}
                                noLabel
                                height="sm"
                              />
                            </div>

                            {/* Note Input - Fixed width */}
                            <div className="lg:col-span-4">
                              <InputGroup
                                type="text"
                                value={entry.comments}
                                handleChange={(e) => handleBulkEntryChange(index, "comments", e.target.value)}
                                placeholder="Ghi chú (tùy chọn)"
                                disabled={isPaused}
                                noLabel
                                height="sm"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 sm:gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <ButtonLink
                  href="/grades"
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
                  <span className="sm:hidden">Lưu</span>
                  <span className="hidden sm:inline">Lưu tất cả điểm số</span>
                </Button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
