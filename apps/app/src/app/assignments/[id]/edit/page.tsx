"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAssignment, useUpdateAssignment, useClasses, useAssignmentTypes, useAssignmentQuizSchema } from "@/hooks/use-api";
import { useGoBack } from "@/hooks/use-go-back";
import InputGroup from "@/components/FormElements/InputGroup";
import DateInput from "@/components/FormElements/DateInput";
import RichTextEditor from "@/components/FormElements/RichTextEditorDynamic";
import LearningResourceSelector from "@/components/FormElements/LearningResourceSelector";
import SelectInput from "@/components/FormElements/SelectInput";
import { Switch } from "@/components/FormElements/switch";
import SubmissionTypesSelector, { SubmissionType } from "@/components/FormElements/SubmissionTypesSelector";
import QuizSettingsFields from "@/components/Assignments/QuizSettingsFields";
import QuizSectionBuilder from "@/components/Assignments/QuizSectionBuilder";
import { DocumentTextIcon, ArrowLeftIcon, CalendarIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { extractFieldErrors, extractErrorMessage } from "@/lib/api-error-utils";
import { useAuthContext } from "@/contexts/auth-context";
import { useResourceGuard } from "@/lib/permission-guards";
import { useNotification } from "@/hooks/use-notification";
import type { QuizQuestion, QuizSettings, QuizSection, QuizSectionDraft } from "@/lib/api-config";
import {
  validateQuestionForType,
  sanitizeQuestionForPayload,
  sanitizeSectionsForPayload,
} from "@/components/Assignments/question-types/validation";
import Button from "@/components/Common/Button";
import { getObjId } from "@/lib/id-utils";

const DEFAULT_QUIZ_SETTINGS: QuizSettings = {
  auto_grade: true,
  shuffle_questions: false,
  show_correct_answers: false,
  show_score_to_student: true,
  time_limit_minutes: null,
};

export default function EditAssignmentPage() {
  const params = useParams();
  const router = useRouter();
  const assignmentId = params.id as string;
  const { user } = useAuthContext();

  // All hooks must be called before any early returns
  const { data: assignment, loading: assignmentLoading, error: assignmentError, permissions } = useAssignment(assignmentId);

  // Use resource guard to protect this route (check after assignment loads)
  const { hasAccess, isChecking } = useResourceGuard(
    user,
    'update',
    'assignment',
    `/assignments/${assignmentId}`,
    {
      checkAfterLoad: true,
      loaded: !assignmentLoading && !!assignment,
    }
  );

  // Use browser history navigation
  const handleGoBack = useGoBack(`/assignments/${assignmentId}`);

  const { data: quizSchema, loading: quizSchemaLoading } = useAssignmentQuizSchema(assignmentId, assignment?.mode === 'quiz');
  const { mutate: updateAssignment, loading: updateLoading, error: updateError } = useUpdateAssignment();
  const { success, error: showError } = useNotification();
  const lastErrorRef = useRef<string | null>(null);

  // Show error notification when update fails (only once per error)
  useEffect(() => {
    if (updateError && updateError !== lastErrorRef.current) {
      lastErrorRef.current = updateError;
      showError(updateError);
    }
  }, [updateError, showError]);

  // Check permissions from API response
  const canManageFromApi = permissions?.can_manage ?? false;
  const { data: classes, loading: classesLoading } = useClasses();
  const { data: assignmentTypes, loading: assignmentTypesLoading } = useAssignmentTypes({ is_active: true });
  const [mode, setMode] = useState<'standard' | 'quiz'>('standard');
  const [quizSettings, setQuizSettings] = useState<QuizSettings>(DEFAULT_QUIZ_SETTINGS);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizSections, setQuizSections] = useState<QuizSectionDraft[]>([]);
  const [quizValidationError, setQuizValidationError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [quizInitialized, setQuizInitialized] = useState(false);
  const quizTotalPoints = useMemo(
    () => quizQuestions.reduce((sum, question) => sum + (Number(question.points) || 0), 0),
    [quizQuestions]
  );

  const [formData, setFormData] = useState({
    class_id: "",
    assignment_type_id: "",
    title: "",
    description: "",
    instructions: "",
    assigned_date: "",
    due_date: "",
    deadline: "",
    max_score: "100",
    allow_late_submission: false,
    max_attempts: "",
    status: "draft",
    learning_resources: [] as (number | string)[],
    allowed_submission_types: ['text'] as SubmissionType[],
  });

  useEffect(() => {
    if (assignment) {
      // Format deadline from ISO string to time format (HH:mm)
      const deadlineTime = assignment.deadline
        ? new Date(assignment.deadline).toTimeString().slice(0, 5)
        : "";

      setFormData({
        class_id: (assignment.class_id || getObjId((assignment as any).class))?.toString() || "",
        assignment_type_id: (assignment.assignment_type_id || getObjId((assignment as any).assignment_type))?.toString() || "",
        title: assignment.title || "",
        description: assignment.description || "",
        instructions: assignment.instructions || "",
        assigned_date: assignment.assigned_date
          ? new Date(assignment.assigned_date).toISOString().split('T')[0]
          : "",
        due_date: assignment.due_date
          ? new Date(assignment.due_date).toISOString().split('T')[0]
          : "",
        deadline: deadlineTime,
        max_score: assignment.max_score?.toString() || assignment.max_points?.toString() || "100",
        allow_late_submission: assignment.allow_late_submission || false,
        max_attempts: assignment.max_attempts?.toString() || "",
        status: assignment.status || "draft",
        learning_resources: assignment.learning_resources?.map((r: any) => getObjId(r) || r) || [],
        allowed_submission_types: (assignment.allowed_submission_types || ['text']) as SubmissionType[],
      });
      setMode((assignment.mode as 'standard' | 'quiz') || 'standard');
      if (assignment.mode === 'quiz') {
        setQuizSettings(assignment.quiz?.settings || assignment.quiz_settings || DEFAULT_QUIZ_SETTINGS);
      } else {
        setQuizSettings(DEFAULT_QUIZ_SETTINGS);
        setQuizQuestions([]);
      }
      setQuizInitialized(false);
    }
  }, [assignment]);

  useEffect(() => {
    if (mode !== 'quiz') {
      setQuizQuestions([]);
      setQuizInitialized(false);
      return;
    }
    if (quizInitialized) {
      return;
    }
    const sourceQuestions = (quizSchema?.questions || assignment?.quiz?.questions || []) as QuizQuestion[];
    if (sourceQuestions.length > 0) {
      setQuizQuestions(sourceQuestions);
      // Restore sections (or synthesize a single holding section for legacy flat quizzes).
      const sourceSections = (quizSchema?.sections || assignment?.quiz?.sections || []) as QuizSection[];
      if (sourceSections.length > 0) {
        setQuizSections(sourceSections.map((s, i) => ({
          _key: s._id,
          section_type: s.section_type || 'general',
          title: s.title || `Phần ${i + 1}`,
          instruction: s.instruction || "",
          media_id: s.media_id ?? null,
          media: s.media ?? null,
          order: s.order ?? i + 1,
        })));
        setQuizQuestions(
          sourceQuestions.map((q) => ({
            ...q,
            section_key: q.section_id || "",
          })) as QuizQuestion[]
        );
      } else {
        const legacyKey = `legacy-${assignmentId}`;
        setQuizSections([{
          _key: legacyKey,
          section_type: "general",
          title: "Phần 1",
          instruction: "",
          media_id: null,
          media: null,
          order: 1,
        }]);
        setQuizQuestions(
          sourceQuestions.map((q) => ({ ...q, section_key: legacyKey })) as QuizQuestion[]
        );
      }
      setQuizInitialized(true);
    }
  }, [mode, quizSchema, assignment, quizInitialized, assignmentId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleRichTextChange = (field: 'description' | 'instructions') => (value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const sanitizeQuizQuestions = () =>
    quizQuestions.map((question, index) => {
      const sanitized = sanitizeQuestionForPayload(question, index);
      return {
        ...sanitized,
        // Existing sections use their hash _id as the client _key; new ones use temp keys.
        section_key: (question as QuizQuestion & { section_key?: string }).section_key
          || quizSections[0]?._key
          || undefined,
      };
    });

  const validateQuizData = (): string | null => {
    if (mode !== 'quiz') return null;
    if (quizQuestions.length === 0) {
      return "Vui lòng thêm ít nhất 1 câu hỏi trắc nghiệm.";
    }
    for (let i = 0; i < quizQuestions.length; i++) {
      const issue = validateQuestionForType(quizQuestions[i], i + 1);
      if (issue) {
        return issue;
      }
    }
    return null;
  };

  useEffect(() => {
    if (mode !== 'quiz') {
      setQuizValidationError(null);
    }
  }, [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    if (!formData.title.trim()) {
      setFieldErrors({ title: "Vui lòng nhập tiêu đề bài tập." });
      return;
    }

    const deadlineDatePart = formData.due_date || formData.assigned_date;
    if (formData.deadline && !deadlineDatePart) {
      showError("Vui lòng chọn Ngày giao hoặc Hạn nộp trước khi đặt giờ deadline.");
      setFieldErrors({ deadline: "Vui lòng chọn Ngày giao hoặc Hạn nộp trước khi đặt giờ deadline." });
      return;
    }
    const deadlineString = formData.deadline && deadlineDatePart
      ? `${deadlineDatePart} ${formData.deadline}:00`
      : undefined;

    const payload: any = {
      class_id: formData.class_id ? formData.class_id : undefined,
      assignment_type_id: formData.assignment_type_id ? formData.assignment_type_id : undefined,
      title: formData.title.trim(),
      description: formData.description || undefined,
      instructions: formData.instructions || undefined,
      assigned_date: formData.assigned_date || undefined,
      due_date: formData.due_date || undefined,
      deadline: deadlineString,
      allow_late_submission: formData.allow_late_submission,
      max_attempts: formData.max_attempts ? parseInt(formData.max_attempts) : null,
      status: formData.status as 'draft' | 'published' | 'closed',
      learning_resources: formData.learning_resources.length > 0 ? formData.learning_resources : undefined,
      mode,
    };

    if (mode === 'quiz') {
      const quizError = validateQuizData();
      if (quizError) {
        setQuizValidationError(quizError);
        return;
      }
      setQuizValidationError(null);
      const sanitizedQuestions = sanitizeQuizQuestions();
      const totalPoints = sanitizedQuestions.reduce((sum, question) => sum + (question.points || 0), 0);
      payload.allowed_submission_types = ['quiz'];
      payload.quiz_settings = quizSettings;
      payload.questions = sanitizedQuestions;
      payload.sections = quizSections.length > 0
        ? sanitizeSectionsForPayload(quizSections.map((s) => ({ ...s, order: s.order ?? 0 })))
        : undefined;
      payload.max_score = totalPoints || 0;
    } else {
      payload.allowed_submission_types = formData.allowed_submission_types.length > 0 ? formData.allowed_submission_types : ['text'];
      payload.max_score = formData.max_score ? parseInt(formData.max_score) : undefined;
      setQuizValidationError(null);
    }

    const result = await updateAssignment(assignmentId, payload);

    if (result.success) {
      success("Cập nhật bài tập thành công");
      setTimeout(() => {
        router.push(`/assignments/${assignmentId}`);
      }, 500);
    } else {
      const errors = extractFieldErrors(result);
      const errorMessage = extractErrorMessage(result, "Có lỗi xảy ra khi cập nhật bài tập");

      setFieldErrors(errors);
      showError(errorMessage);
    }
  };

  // Consolidate loading state
  const isLoading = assignmentLoading || isChecking;

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-12 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-12 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
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

  if (assignmentError || (!assignmentLoading && !assignment)) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
        <h3 className="font-medium mb-2">Lỗi tải dữ liệu</h3>
        <p>{assignmentError || "Không tìm thấy bài tập"}</p>
      </div>
    );
  }

  // Show nothing while checking permissions or redirecting (only after loading is done)
  if (!isLoading && (!hasAccess || (assignment && permissions !== undefined && !canManageFromApi))) {
    return null;
  }

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
          <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white truncate">Chỉnh sửa bài tập</h1>
          <p className="text-dark-4 dark:text-dark-6 mt-1 break-words">
            Cập nhật thông tin bài tập &quot;{assignment.title}&quot;
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-2xl rounded-lg bg-white p-6 dark:bg-gray-800 space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
            Hình thức bài tập
          </label>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode('standard')}
              className={`rounded-2xl border p-4 text-left transition-all ${mode === 'standard'
                ? 'border-primary bg-primary/5'
                : 'border-gray-200 dark:border-gray-700'
                }`}
            >
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Bài tập thường</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Học viên nộp bài bằng văn bản, file hoặc liên kết.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setMode('quiz')}
              className={`rounded-2xl border p-4 text-left transition-all ${mode === 'quiz'
                ? 'border-primary bg-primary/5'
                : 'border-gray-200 dark:border-gray-700'
                }`}
            >
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Bài trắc nghiệm</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Tạo câu hỏi nhiều lựa chọn, hệ thống tự chấm điểm.
              </p>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SelectInput
            label="Lớp học"
            name="class_id"
            value={formData.class_id}
            handleChange={handleChange}
            error={fieldErrors.class_id}
            placeholder={classesLoading ? "Đang tải lớp học..." : "-- Chọn lớp học --"}
            options={
              classesLoading
                ? []
                : (classes || []).map((classItem: any) => ({
                  value: getObjId(classItem),
                  label: classItem.name,
                }))
            }
            helperText={
              classesLoading
                ? "Đang tải danh sách lớp..."
                : undefined
            }
          />

          <SelectInput
            label="Loại bài tập"
            name="assignment_type_id"
            value={formData.assignment_type_id}
            handleChange={handleChange}
            error={fieldErrors.assignment_type_id}
            placeholder={assignmentTypesLoading ? "Đang tải loại bài..." : "-- Chọn loại bài tập --"}
            options={
              assignmentTypesLoading
                ? []
                : (assignmentTypes || []).map((type: any) => ({
                  value: getObjId(type),
                  label: type.display_name || type.name,
                }))
            }
            helperText={
              assignmentTypesLoading
                ? "Đang tải danh sách loại bài tập..."
                : undefined
            }
          />
        </div>

        <InputGroup
          type="text"
          label="Tiêu đề bài tập"
          placeholder="Nhập tiêu đề bài tập"
          name="title"
          value={formData.title}
          handleChange={handleChange}
          icon={<DocumentTextIcon />}
          required
          error={fieldErrors.title}
        />

        <RichTextEditor
          label="Mô tả"
          value={formData.description}
          onChange={handleRichTextChange('description')}
          placeholder="Nhập mô tả bài tập (tùy chọn)"
          error={fieldErrors.description}
        />

        <RichTextEditor
          label="Hướng dẫn"
          value={formData.instructions}
          onChange={handleRichTextChange('instructions')}
          placeholder="Nhập hướng dẫn làm bài (tùy chọn)"
          error={fieldErrors.instructions}
        />

        <LearningResourceSelector
          value={formData.learning_resources}
          onChange={(ids) => setFormData(prev => ({ ...prev, learning_resources: ids }))}
          label="Tài liệu đính kèm"
          error={fieldErrors.learning_resources}
          initialResources={assignment?.learning_resources}
        />

        {mode === 'standard' && (
          <SubmissionTypesSelector
            value={formData.allowed_submission_types}
            onChange={(types) => setFormData(prev => ({ ...prev, allowed_submission_types: types }))}
            label="Định dạng bài nộp được phép"
            error={fieldErrors.allowed_submission_types}
          />
        )}

        {mode === 'quiz' && (
          <div className="space-y-6">
            <QuizSettingsFields
              value={quizSettings}
              onChange={setQuizSettings}
              error={fieldErrors.quiz_settings}
            />
            {quizSchemaLoading && (
              <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-300">
                Đang tải cấu trúc câu hỏi...
              </div>
            )}
            {quizValidationError && (
              <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                {quizValidationError}
              </div>
            )}
            <QuizSectionBuilder
              questions={quizQuestions}
              onChangeQuestions={(next) => {
                setQuizQuestions(next);
                setQuizValidationError(null);
              }}
              sections={quizSections.length > 0 ? quizSections : [{
                _key: `legacy-${assignmentId}`,
                section_type: "general",
                title: "Phần 1",
                instruction: "",
                media_id: null,
                media: null,
                order: 1,
              }]}
              onChangeSections={(next) => {
                setQuizSections(next);
                setQuizValidationError(null);
              }}
              disabled={updateLoading || quizSchemaLoading}
              error={fieldErrors.questions}
              assignmentId={assignmentId}
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DateInput
            label="Ngày giao"
            name="assigned_date"
            value={formData.assigned_date}
            handleChange={handleChange}
            icon={<CalendarIcon />}
            placeholder="Chọn ngày giao"
            error={fieldErrors.assigned_date}
          />

          <DateInput
            label="Hạn nộp (ngày)"
            name="due_date"
            value={formData.due_date}
            handleChange={handleChange}
            icon={<CalendarIcon />}
            placeholder="Chọn ngày hạn nộp"
            error={fieldErrors.due_date}
          />

          <InputGroup
            type="time"
            label="Hạn nộp (giờ)"
            name="deadline"
            value={formData.deadline}
            handleChange={handleChange}
            placeholder="Chọn giờ deadline"
            helperText="Giờ deadline (kết hợp với hạn nộp)"
            error={fieldErrors.deadline}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputGroup
            type="number"
            label="Điểm tối đa"
            name="max_score"
            value={mode === 'quiz' ? quizTotalPoints.toString() : formData.max_score}
            handleChange={(e) => {
              if (mode === 'quiz') return;
              handleChange(e);
            }}
            disabled={mode === 'quiz'}
            placeholder="100"
            min={1}
            required
            error={fieldErrors.max_score}
            helperText={
              mode === 'quiz'
                ? `Điểm tối đa được tự động tính theo tổng điểm của câu hỏi (hiện tại: ${quizTotalPoints} điểm).`
                : "Nhập tổng điểm cho bài tập."
            }
          />

          <SelectInput
            label="Trạng thái"
            name="status"
            value={formData.status}
            handleChange={handleChange}
            required
            error={fieldErrors.status}
            options={[
              { value: "draft", label: "Sắp giao" },
              { value: "published", label: "Đang giao" },
              { value: "closed", label: "Đã kết thúc" },
            ]}
          />
        </div>

        <Switch
          name="allow_late_submission"
          checked={formData.allow_late_submission}
          onChange={handleChange}
          label="Cho phép nộp muộn"
          error={fieldErrors.allow_late_submission}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputGroup
            label="Giới hạn số lần nộp"
            name="max_attempts"
            type="number"
            value={formData.max_attempts}
            handleChange={handleChange}
            placeholder="Để trống = không giới hạn"
            min="1"
            error={fieldErrors.max_attempts}
            helperText="Số lần tối đa học viên có thể nộp bài. Để trống nếu không giới hạn."
          />
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 sm:gap-4">
          <Button
            type="button"
            onClick={handleGoBack}
            variant="outline"
            size="sm"
            className="w-full sm:w-auto justify-center"
          >
            Hủy
          </Button>
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
            <span className="hidden sm:inline">Cập nhật bài tập</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
