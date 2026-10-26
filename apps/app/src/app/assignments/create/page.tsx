"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useCreateAssignment, useClasses, useAssignmentTypes } from "@/hooks/use-api";
import { useGoBack } from "@/hooks/use-go-back";
import { useAuthContext } from "@/contexts/auth-context";
import { useResourceGuard } from "@/lib/permission-guards";
import InputGroup from "@/components/FormElements/InputGroup";
import DateInput from "@/components/FormElements/DateInput";
import SelectInput from "@/components/FormElements/SelectInput";
import { Switch } from "@/components/FormElements/switch";

// Lazy load heavy components
const RichTextEditor = dynamic(() => import("@/components/FormElements/RichTextEditor"), {
  loading: () => <div className="h-32 bg-gray-100 dark:bg-gray-800 animate-pulse rounded" />,
});
const LearningResourceSelector = dynamic(() => import("@/components/FormElements/LearningResourceSelector"), {
  loading: () => <div className="h-20 bg-gray-100 dark:bg-gray-800 animate-pulse rounded" />,
});
const SubmissionTypesSelector = dynamic(() => import("@/components/FormElements/SubmissionTypesSelector"), {
  loading: () => <div className="h-20 bg-gray-100 dark:bg-gray-800 animate-pulse rounded" />,
});
const QuizSettingsFields = dynamic(() => import("@/components/Assignments/QuizSettingsFields"), {
  loading: () => <div className="h-40 bg-gray-100 dark:bg-gray-800 animate-pulse rounded" />,
});
const QuizSectionBuilder = dynamic(() => import("@/components/Assignments/QuizSectionBuilder"), {
  loading: () => <div className="h-64 bg-gray-100 dark:bg-gray-800 animate-pulse rounded" />,
});
import { extractFieldErrors, extractErrorMessage } from "@/lib/api-error-utils";
import { useNotification } from "@/hooks/use-notification";
import type { QuizQuestion, QuizSettings, QuizSectionDraft } from "@/lib/api-config";
import {
  validateQuestionForType,
  sanitizeQuestionForPayload,
  sanitizeSectionsForPayload,
} from "@/components/Assignments/question-types/validation";
import { DocumentTextIcon, ArrowLeftIcon, CalendarIcon, ChevronLeftIcon, ChevronRightIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import type { AssignmentFormData, WizardStep, WizardStepId } from "./types";
import AssignmentModeSelector from "./_components/AssignmentModeSelector";
import Button from "@/components/Common/Button";
import ButtonLink from "@/components/Common/ButtonLink";
import { getObjId } from "@/lib/id-utils";

const createDefaultSection = (): QuizSectionDraft => ({
  _key: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  section_type: "general",
  title: "Phần 1",
  instruction: "",
  media_id: null,
  media: null,
  order: 1,
});

export default function CreateAssignmentPage() {  const router = useRouter();
  const { user } = useAuthContext();
  const handleGoBack = useGoBack('/assignments');

  // Use resource guard to protect this route
  useResourceGuard(
    user,
    'create',
    'assignment',
    '/403'
  );

  // All hooks must be called before any early returns
  const { mutate: createAssignment, loading: createLoading, error: createError } = useCreateAssignment();
  const { data: classes, loading: classesLoading } = useClasses();
  const { data: assignmentTypes, loading: assignmentTypesLoading } = useAssignmentTypes({ is_active: true });
  const { success, error: showError } = useNotification();

  const isLoading = classesLoading || assignmentTypesLoading;

  const [mode, setMode] = useState<'standard' | 'quiz'>('standard');
  const [activeStep, setActiveStep] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<AssignmentFormData>({
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
    learning_resources: [],
    allowed_submission_types: ['text'],
  });
  const [quizSettings, setQuizSettings] = useState<QuizSettings>({
    auto_grade: true,
    shuffle_questions: false,
    show_correct_answers: false,
    show_score_to_student: true,
    time_limit_minutes: null,
  });
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizSections, setQuizSections] = useState<QuizSectionDraft[]>([createDefaultSection()]);
  const [quizValidationError, setQuizValidationError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const steps = useMemo<WizardStep[]>(() => {
    const baseSteps: WizardStep[] = [
      {
        id: "general",
        title: "Thông tin chung",
        description: "Chọn lớp học, tiêu đề, hạn nộp",
      },
    ];
    if (mode === "quiz") {
      baseSteps.push(
        {
          id: "quiz-config",
          title: "Cấu hình trắc nghiệm",
          description: "Thiết lập cách chấm điểm, thời gian, tuỳ chọn tự động",
        },
        {
          id: "questions",
          title: "Ngân hàng câu hỏi",
          description: "Thêm câu hỏi & đáp án cho bài trắc nghiệm",
        }
      );
    }
    return baseSteps;
  }, [mode]);
  useEffect(() => {
    setActiveStep((prev) => {
      const maxIndex = steps.length - 1;
      if (mode !== "quiz") return 0;
      return Math.min(prev, maxIndex);
    });
  }, [mode, steps.length]);

  const quizTotalPoints = useMemo(
    () => quizQuestions.reduce((sum, question) => sum + (Number(question.points) || 0), 0),
    [quizQuestions]
  );

  const renderTimeline = () => {
    if (mode !== "quiz" || steps.length <= 1) return null;
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-3 sm:p-4 dark:border-gray-700 dark:bg-gray-800/70">
        <p className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">
          Các bước thiết lập bài trắc nghiệm
        </p>
        <div className="space-y-3 sm:space-y-4">
          {steps.map((step, index) => {
            const isActive = index === activeStep;
            const isCompleted = index < activeStep;
            return (
              <div key={step.id} className="flex gap-2 sm:gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={`flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full text-[10px] sm:text-[11px] font-semibold ${isActive
                      ? "bg-primary text-white"
                      : isCompleted
                        ? "bg-emerald-500 text-white"
                        : "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-300"
                      }`}
                  >
                    {index + 1}
                  </span>
                  {index < steps.length - 1 && (
                    <span className="mt-1 h-full w-px flex-1 bg-gray-200 dark:bg-gray-700" />
                  )}
                </div>
                <div
                  className={`flex-1 rounded-xl border px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm ${isActive
                    ? "border-primary bg-white text-gray-900 dark:border-primary/60 dark:bg-gray-900/40 dark:text-gray-100"
                    : "border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    }`}
                >
                  <p className="font-semibold text-gray-900 dark:text-white">{step.title}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

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

  const getQuizValidationIssue = (questions: QuizQuestion[] = quizQuestions): string | null => {
    if (questions.length === 0) {
      return "Vui lòng thêm ít nhất 1 câu hỏi trắc nghiệm.";
    }
    for (let i = 0; i < questions.length; i++) {
      const issue = validateQuestionForType(questions[i], i + 1);
      if (issue) {
        return issue;
      }
    }
    return null;
  };

  const sanitizeQuizQuestions = () =>
    quizQuestions.map((question, index) => {
      const sanitized = sanitizeQuestionForPayload(question, index);
      // Attach the section link via the client temp key (resolved server-side against sections.*._key).
      const sectionKey = (question as QuizQuestion & { section_key?: string }).section_key;
      return {
        ...sanitized,
        section_key: sectionKey || quizSections[0]?._key || undefined,
      };
    });

  const validateQuizData = (): string | null => {
    if (mode !== 'quiz') {
      setQuizValidationError(null);
      return null;
    }
    const issue = getQuizValidationIssue();
    if (issue) {
      setQuizValidationError(issue);
      return issue;
    }
    setQuizValidationError(null);
    return null;
  };

  const validateGeneralStep = () => {
    const errors: Record<string, string> = {};
    if (!formData.title.trim()) {
      errors.title = "Vui lòng nhập tiêu đề bài tập.";
    }
    if (!formData.class_id) {
      errors.class_id = "Vui lòng chọn lớp học.";
    }
    if (!formData.assignment_type_id) {
      errors.assignment_type_id = "Vui lòng chọn loại bài tập.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setGeneralError("Vui lòng điền đầy đủ thông tin bắt buộc.");
      return false;
    }

    setFieldErrors({});
    setGeneralError(null);
    return true;
  };

  const validateStepById = (stepId: WizardStepId) => {
    switch (stepId) {
      case "general":
        return validateGeneralStep();
      case "quiz-config":
        return true;
      case "questions": {
        const issue = getQuizValidationIssue();
        if (issue) {
          setQuizValidationError(issue);
          return false;
        }
        setQuizValidationError(null);
        return true;
      }
      default:
        return true;
    }
  };

  const handleNextStep = () => {
    if (activeStep >= steps.length - 1) return;
    const currentStep = steps[activeStep];
    if (!currentStep) return;
    if (!validateStepById(currentStep.id)) {
      return;
    }
    setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePreviousStep = () => {
    setActiveStep((prev) => Math.max(prev - 1, 0));
    setGeneralError(null);
    setFieldErrors({});
  };

  useEffect(() => {
    if (mode !== 'quiz') {
      setQuizValidationError(null);
    }
  }, [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'quiz' && activeStep < steps.length - 1) {
      const currentStep = steps[activeStep];
      if (currentStep && validateStepById(currentStep.id)) {
        setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      return;
    }

    if (!validateGeneralStep()) {
      return;
    }

    // Validate và parse các giá trị
    const classId = formData.class_id;
    const assignmentTypeId = formData.assignment_type_id;

    if (!classId || !assignmentTypeId) {
      setGeneralError("Vui lòng chọn đầy đủ lớp học và loại bài tập.");
      return;
    }

    const deadlineDatePart = formData.due_date || formData.assigned_date;
    if (formData.deadline && !deadlineDatePart) {
      setGeneralError("Vui lòng chọn Ngày giao hoặc Hạn nộp trước khi đặt giờ deadline.");
      return;
    }
    const deadlineString = formData.deadline && deadlineDatePart
      ? `${deadlineDatePart} ${formData.deadline}:00`
      : undefined;

    const basePayload: any = {
      class_id: classId,
      assignment_type_id: assignmentTypeId,
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
      basePayload.mode = 'quiz';
      basePayload.allowed_submission_types = ['quiz'];
      basePayload.quiz_settings = quizSettings;
      basePayload.questions = sanitizedQuestions;
      basePayload.sections = sanitizeSectionsForPayload(
        quizSections.map((s) => ({ ...s, order: s.order ?? 0 }))
      );
      basePayload.max_score = totalPoints || 0;
    } else {
      basePayload.mode = 'standard';
      basePayload.allowed_submission_types = formData.allowed_submission_types.length > 0 ? formData.allowed_submission_types : ['text'];
      basePayload.max_score = parseInt(formData.max_score) || 100;
    }

    // Validate payload structure trước khi gửi
    if (!basePayload.class_id || !basePayload.assignment_type_id || !basePayload.title) {
      setGeneralError("Vui lòng điền đầy đủ thông tin bắt buộc.");
      return;
    }

    // Đảm bảo không có trường nào là object không hợp lệ (tránh gửi nhầm)
    // Cho phép quiz_settings và questions là object/array
    const allowedObjectFields = ['quiz_settings', 'questions', 'sections'];
    const hasInvalidFields = Object.entries(basePayload).some(([key, val]) => {
      if (allowedObjectFields.includes(key)) {
        return false; // Cho phép các field này là object/array
      }
      return val !== null && val !== undefined && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date);
    });

    if (hasInvalidFields) {
      console.error('Invalid payload structure:', basePayload);
      setGeneralError("Có lỗi xảy ra với dữ liệu form. Vui lòng thử lại.");
      return;
    }

    const result = await createAssignment(basePayload);

    if (result.success) {
      success("Tạo bài tập thành công!");
      router.push('/assignments');
    } else {
      const errors = extractFieldErrors(result);
      const errorMessage = extractErrorMessage(result, "Có lỗi xảy ra khi tạo bài tập");

      setFieldErrors(errors);
      setGeneralError(errorMessage);
      showError(errorMessage);
    }
  };

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
            <div className="flex items-center gap-4">
              <div className="h-12 w-32 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-12 w-20 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentStep = steps[activeStep] ?? steps[0];
  const currentStepId: WizardStepId = currentStep?.id ?? "general";
  const showGeneralSection = mode !== "quiz" || currentStepId === "general";
  const showQuizConfigSection = mode === "quiz" && currentStepId === "quiz-config";
  const showQuestionsSection = mode === "quiz" && currentStepId === "questions";
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
          <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white truncate">Tạo bài tập mới</h1>
          <p className="text-dark-4 dark:text-dark-6 mt-1 break-words">
            Tạo bài tập mới cho học viên
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-2xl rounded-lg bg-white p-6 dark:bg-gray-800 space-y-6">
        {createError && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {createError}
          </div>
        )}

        {renderTimeline()}

        {showGeneralSection && (
          <div className="space-y-6">
            <AssignmentModeSelector mode={mode} onChange={setMode} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SelectInput
                label="Lớp học"
                name="class_id"
                value={formData.class_id}
                handleChange={handleChange}
                required
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
                    : (classes || []).length === 0
                      ? "Chưa có lớp nào, hãy tạo lớp trước khi giao bài."
                      : undefined
                }
              />

              <SelectInput
                label="Loại bài tập"
                name="assignment_type_id"
                value={formData.assignment_type_id}
                handleChange={handleChange}
                required
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
                    : (assignmentTypes || []).length === 0
                      ? "Chưa có loại bài tập nào."
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

            {generalError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                {generalError}
              </div>
            )}

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
                min="1"
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

            <LearningResourceSelector
              value={formData.learning_resources}
              onChange={(ids) => setFormData(prev => ({ ...prev, learning_resources: ids }))}
              label="Tài liệu đính kèm"
              error={fieldErrors.learning_resources}
            />

            {mode === 'standard' && (
              <SubmissionTypesSelector
                value={formData.allowed_submission_types}
                onChange={(types) => setFormData(prev => ({ ...prev, allowed_submission_types: types }))}
                label="Định dạng bài nộp được phép"
                error={fieldErrors.allowed_submission_types}
              />
            )}

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
          </div>
        )}

        {showQuizConfigSection && (
          <div className="space-y-6">
            <QuizSettingsFields
              value={quizSettings}
              onChange={setQuizSettings}
              error={fieldErrors.quiz_settings}
            />
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
              <p className="font-semibold text-gray-900 dark:text-white">Tổng quan nhanh</p>
              <ul className="mt-2 space-y-1">
                <li>• Điểm tối đa dự kiến: {quizTotalPoints} điểm</li>
                <li>• Trạng thái chấm bài: {quizSettings.auto_grade ? "Tự động chấm điểm" : "Chờ chấm thủ công"}</li>
                <li>
                  • Giới hạn thời gian:{" "}
                  {quizSettings.time_limit_minutes ? `${quizSettings.time_limit_minutes} phút` : "Không giới hạn"}
                </li>
              </ul>
            </div>
          </div>
        )}

        {showQuestionsSection && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Chia đề thành các phần thi (Listening, Reading...) — mỗi phần có hướng dẫn và media riêng.
              Một phần duy nhất là đề trắc nghiệm thông thường.
            </p>
            <QuizSectionBuilder
              questions={quizQuestions}
              onChangeQuestions={(next) => {
                setQuizQuestions(next);
                setQuizValidationError(null);
              }}
              sections={quizSections}
              onChangeSections={setQuizSections}
              disabled={createLoading}
              error={fieldErrors.questions}
            />
            {quizValidationError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                {quizValidationError}
              </div>
            )}
          </div>
        )}

        <div className="space-y-2 border-t border-gray-200 pt-4 dark:border-gray-700">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {mode === "quiz" && steps.length > 1 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Bước {activeStep + 1}/{steps.length}: {currentStep?.title}
              </p>
            ) : (
              <span />
            )}
            <div className="flex flex-col-reverse sm:flex-row sm:flex-wrap sm:justify-end gap-3 w-full sm:w-auto">
              {mode === "quiz" && activeStep > 0 && (
                <Button
                  type="button"
                  onClick={handlePreviousStep}
                  variant="outline"
                  size="sm"
                  icon={<ChevronLeftIcon />}
                  className="w-full sm:w-auto justify-center"
                >
                  Quay lại
                </Button>
              )}
              {mode === "quiz" && activeStep < steps.length - 1 && (
                <Button
                  type="button"
                  onClick={handleNextStep}
                  size="sm"
                  variant="primary"
                  icon={<ChevronRightIcon />}
                  className="w-full sm:w-auto justify-center"
                >
                  Tiếp tục
                </Button>
              )}
              {(mode !== "quiz" || activeStep === steps.length - 1) && (
                <Button
                  type="submit"
                  disabled={createLoading}
                  loading={createLoading}
                  size="sm"
                  variant="primary"
                  icon={<CheckCircleIcon />}
                  className="w-full sm:w-auto justify-center"
                >
                  Hoàn tất
                </Button>
              )}
              <ButtonLink
                href="/assignments"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto justify-center"
              >
                Hủy
              </ButtonLink>
            </div>
          </div>
        </div>

      </form>
    </div>
  );
}
