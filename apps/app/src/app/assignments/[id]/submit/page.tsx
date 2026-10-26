"use client";
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { getObjId, idsEqual } from "@/lib/id-utils";
import { useParams, useRouter } from "next/navigation";
import { useAssignment, useCreateSubmission, useAssignmentQuizTake, useStudentClasses, useLatestSubmission } from "@/hooks/use-api";
import { useGoBack } from "@/hooks/use-go-back";
import { useAuthContext } from "@/contexts/auth-context";
import DynamicSubmissionForm from "@/components/FormElements/DynamicSubmissionForm";
import QuizTakeForm from "@/components/Assignments/QuizTakeForm";
import QuizMediaDisplay from "@/components/Common/QuizMediaDisplay";
import QuizSectionNavigator, { buildTakeNavigator } from "@/components/Assignments/question-types/QuizSectionNavigator";
import QuizExamBar from "@/components/Assignments/question-types/QuizExamBar";
import { questionTypeDescriptor } from "@/components/Assignments/question-types/registry";
import type { QuizAnswerDraft } from "@/components/Assignments/question-types/types";
import type { QuizQuestion, QuizSection } from "@/lib/api-config";
import { useToast } from "@/contexts/toast-context";
import { ArrowLeftIcon, DocumentArrowUpIcon, ClockIcon, PlayIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import ButtonLink from "@/components/Common/ButtonLink";
import Button from "@/components/Common/Button";
import PausedStudentBanner from "@/components/Students/PausedStudentBanner";
import { useStudentId } from "@/hooks/use-student-id";
import { isStudent } from "@/lib/authz";
import { useLockContext } from "@/contexts/lock-context";
import { useErrorDisplay } from "@/components/Common/ErrorDisplay";
import { useFaviconTimer } from "@/hooks/use-favicon-timer";
import { useFakeProgress } from "@/hooks/use-fake-progress";
import { useFaviconProgress } from "@/hooks/use-favicon-progress";
import { Skeleton } from "@/components/ui/skeleton";

type QuizAnswer = QuizAnswerDraft;

/** Build the API answer payload — delegated to the question-type registry. */
function buildAnswerPayload(question: QuizQuestion, answer: QuizAnswer) {
  return questionTypeDescriptor(question.question_type).buildAnswerPayload(question, answer);
}

/** Whether a question has been answered (used for the "unanswered" confirmation prompt). */
function isQuestionAnswered(question: QuizQuestion, answer: QuizAnswer): boolean {
  return questionTypeDescriptor(question.question_type).isAnswered(answer);
}

export default function SubmitAssignmentPage() {
  const params = useParams();
  const router = useRouter();
  const assignmentId = params.id as string;
  const { user } = useAuthContext();
  const { actionsLocked, planFeatureMessage } = useLockContext();
  const isStudentUser = isStudent(user);
  const { studentId } = useStudentId();
  const { addToast } = useToast();
  const { renderError } = useErrorDisplay("Nộp bài tập");

  const { data: assignment, loading: assignmentLoading, permissions } = useAssignment(assignmentId);

  // Use permissions from API response, fallback to false if not available
  const canManage = permissions?.can_manage ?? false;
  const { mutate: createSubmission, loading: createLoading, error: createError } = useCreateSubmission();
  const isQuizAssignment = assignment?.mode === 'quiz';
  const { data: quizTake, loading: quizTakeLoading, error: quizTakeError } = useAssignmentQuizTake(assignmentId, Boolean(isQuizAssignment));

  // Extract questions and settings from quizTake response (handle different response structures)
  const quizQuestions = useMemo(() => {
    if (!quizTake) return [];
    // Handle different response structures
    if (Array.isArray(quizTake)) {
      return quizTake;
    }
    if (quizTake.questions && Array.isArray(quizTake.questions)) {
      return quizTake.questions;
    }
    if (quizTake.data && Array.isArray(quizTake.data)) {
      return quizTake.data;
    }
    if (quizTake.data?.questions && Array.isArray(quizTake.data.questions)) {
      return quizTake.data.questions;
    }
    return [];
  }, [quizTake]);

  // Extract settings from quizTake response
  const quizSettings = useMemo(() => {
    if (!quizTake) return null;
    if (quizTake.settings) return quizTake.settings;
    if (quizTake.data?.settings) return quizTake.data.settings;
    return null;
  }, [quizTake]);

  // Exam sections (IELTS Listening Part, Reading Passage...) — optional; a flat quiz has none.
  const quizSections = useMemo<QuizSection[]>(() => {
    if (!quizTake) return [];
    const raw =
      (quizTake as { sections?: QuizSection[] }).sections ||
      quizTake.data?.sections ||
      [];
    return Array.isArray(raw) ? raw : [];
  }, [quizTake]);

  // Group questions by section (section_id → section._id). Unsectioned questions go first.
  const questionGroups = useMemo(() => {
    if (quizSections.length === 0) {
      return quizQuestions.length ? [{ section: null, questions: quizQuestions }] : [];
    }
    return quizSections.map((section) => ({
      section,
      questions: quizQuestions.filter((q: QuizQuestion) =>
        q.section_id && String(q.section_id) === String(section._id)),
    }));
  }, [quizSections, quizQuestions]);
  const assignmentClassId = useMemo(() => {
    if (!assignment) return "";
    const candidates = [
      assignment.class?.id,
      assignment.class_id,
      assignment.classId,
      assignment.student_class_id,
      assignment.classroom_id,
      assignment.classroomId,
    ];
    const found = candidates.find((value) => value !== undefined && value !== null && String(value).trim() !== "");
    return found ? String(found) : "";
  }, [assignment]);
  const shouldLoadStudentClasses = isStudentUser && !!studentId;
  const { classes: studentClasses } = useStudentClasses(
    shouldLoadStudentClasses ? studentId : '0'
  );
  const canResolveEnrollment = shouldLoadStudentClasses && !!assignmentClassId;
  const pausedEnrollment = useMemo(() => {
    if (!canResolveEnrollment || !studentClasses || studentClasses.length === 0) {
      return null;
    }
    const targetClass = studentClasses.find((cls: any) => {
      const identifier =
        cls.id ??
        cls.class_id ??
        cls.classId ??
        cls.class?.id ??
        cls.pivot?.class_id;
      return identifier && idsEqual(identifier, assignmentClassId);
    });
    return targetClass?.enrollment || targetClass?.pivot || null;
  }, [canResolveEnrollment, studentClasses, assignmentClassId]);
  const isStudentPaused = canResolveEnrollment && !!pausedEnrollment?.is_paused;

  // Get latest submission to check attempts limit
  const assignmentEnrollment =
    assignment?.class?.enrollment ||
    assignment?.student_enrollment ||
    assignment?.enrollment ||
    assignment?.classroom?.enrollment;
  const { data: latestSubmission } = useLatestSubmission(
    assignmentId,
    isStudentUser && !!assignmentId && !assignmentEnrollment?.is_paused
  );
  const attemptsInfo = latestSubmission?.attempts_info;
  const limitReached = attemptsInfo?.limit_reached || false;

  const [submissionData, setSubmissionData] = useState<{
    content?: string;
    media_id?: string;
    external_url?: string;
  }>({});
  const [quizAnswers, setQuizAnswers] = useState<Record<string, QuizAnswerDraft>>({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [unansweredCount, setUnansweredCount] = useState(0);
  const [isConfirmPortalReady, setIsConfirmPortalReady] = useState(false);

  useEffect(() => {
    setIsConfirmPortalReady(true);
  }, []);
  const [quizStarted, setQuizStarted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null); // seconds
  const [timeExpired, setTimeExpired] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null); // ISO string
  const autoSubmittedRef = useRef(false);

  // Favicon Logic
  // Priority: 1. Submission Progress, 2. Quiz Timer
  const isSubmitting = createLoading;

  // Progress (Only shows when isSubmitting is true)
  const submissionProgress = useFakeProgress(isSubmitting);
  useFaviconProgress(submissionProgress ?? 0);

  // Timer (pause/hide when submitting to avoid conflict)
  const totalSeconds = quizSettings?.time_limit_minutes ? quizSettings.time_limit_minutes * 60 : null;
  useFaviconTimer({
    remainingSeconds: timeRemaining,
    totalSeconds: totalSeconds,
    isRunning: quizStarted && !timeExpired && timeRemaining !== null && !isSubmitting
  });

  useEffect(() => {
    if (quizQuestions.length > 0) {
      setQuizAnswers({});
    }
  }, [quizQuestions]);

  // Draft autosave/resume: answers + start time survive an accidental reload.
  // Keyed per assignment (student scope comes from the auth cookie) and cleared on submit.
  const draftStorageKey = `quiz-draft:${assignmentId}`;
  const quizStartedRef = useRef(quizStarted);
  quizStartedRef.current = quizStarted;

  const clearQuizDraft = useCallback(() => {
    try {
      window.localStorage.removeItem(`quiz-draft:${assignmentId}`);
    } catch {
      // ignore
    }
  }, [assignmentId]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftStorageKey);
      if (!raw) return;
      const draft = JSON.parse(raw) as {
        answers?: Record<string, QuizAnswerDraft>;
        startedAt?: string;
      };
      if (draft.answers && Object.keys(draft.answers).length > 0) {
        setQuizAnswers((prev) => ({ ...draft.answers, ...prev }));
      }
      if (draft.startedAt) {
        setStartedAt((prev) => prev ?? draft.startedAt ?? null);
      }
    } catch {
      // Corrupt draft — ignore, the student starts fresh.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftStorageKey]);

  useEffect(() => {
    if (!quizStarted || Object.keys(quizAnswers).length === 0) return;
    try {
      window.localStorage.setItem(
        draftStorageKey,
        JSON.stringify({ answers: quizAnswers, startedAt: startedAt })
      );
    } catch {
      // Storage full/unavailable — autosave is best-effort.
    }
  }, [quizAnswers, startedAt, quizStarted, draftStorageKey]);

  // Warn before leaving with an unfinished quiz in progress.
  useEffect(() => {
    if (!quizStarted || quizQuestions.length === 0) return;
    const hasAnyAnswer = Object.values(quizAnswers).some(
      (value) => value !== null && (!Array.isArray(value) || value.length > 0)
    );
    if (!hasAnyAnswer) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [quizStarted, quizQuestions.length, quizAnswers]);

  // Initialize timer when quiz starts
  useEffect(() => {
    if (quizStarted && quizSettings?.time_limit_minutes && !timeExpired) {
      const totalSeconds = quizSettings.time_limit_minutes * 60;
      setTimeRemaining(totalSeconds);
    }
  }, [quizStarted, quizSettings?.time_limit_minutes, timeExpired]);

  // Countdown timer
  useEffect(() => {
    if (quizStarted && timeRemaining !== null && timeRemaining > 0 && !timeExpired) {
      const timer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev === null || prev <= 1) {
            setTimeExpired(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [quizStarted, timeRemaining, timeExpired]);

  // Auto submit when time expires
  useEffect(() => {
    if (timeExpired && quizStarted && !createLoading && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true; // Mark as submitted to prevent duplicate submissions

      const handleAutoSubmit = async () => {
        if (!assignment || !quizQuestions || quizQuestions.length === 0) {
          addToast({ type: "error", title: "Không thể tự động nộp bài. Vui lòng thử lại." });
          return;
        }

        // Submit with current answers (including unanswered questions)
        const answersPayload = quizQuestions.map((question: QuizQuestion) =>
          buildAnswerPayload(question, quizAnswers[getObjId(question) ?? ''] ?? null)
        );

        const result = await createSubmission({
          assignment_id: assignmentId,
          answers: answersPayload,
          started_at: startedAt || undefined, // Gửi thời gian bắt đầu làm bài
        });

        if (result.success) {
          clearQuizDraft();
          addToast({ type: "success", title: "Hết thời gian! Bài làm đã được tự động nộp." });
          setTimeout(() => {
            router.push(`/assignments/${assignmentId}`);
          }, 1000);
        } else {
          // Handle MAX_ATTEMPTS_EXCEEDED error specifically for auto submit
          if (result.code === 'MAX_ATTEMPTS_EXCEEDED') {
            const errorMessage = result.message || (result.errors
              ? `Bạn đã đạt giới hạn số lần nộp (${result.errors.max_attempts} lần). Bạn đã nộp ${result.errors.current_attempts}/${result.errors.max_attempts} lần.`
              : "Bạn đã đạt giới hạn số lần nộp");
            addToast({
              type: "error",
              title: errorMessage
            });
          } else {
            addToast({ type: "error", title: result.message || "Lỗi khi tự động nộp bài" });
          }
        }
      };

      // Small delay to ensure state is stable
      const timeoutId = setTimeout(() => {
        handleAutoSubmit();
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [timeExpired, quizStarted, createLoading, assignment, quizQuestions, quizAnswers, assignmentId, createSubmission, addToast, router, clearQuizDraft, startedAt]);

  const handleStartQuiz = () => {
    setQuizStarted(true);
    // Keep a restored draft's original start time so "time spent" stays honest.
    setStartedAt((prev) => prev ?? new Date().toISOString());
    autoSubmittedRef.current = false; // Reset auto submit flag when starting new quiz
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Answered count shared by the inline progress line, the question palette and the exam bar.
  const answeredCount = useMemo(
    () => quizQuestions.filter((question: QuizQuestion) =>
      isQuestionAnswered(question, quizAnswers[getObjId(question) ?? ''] ?? null)
    ).length,
    [quizQuestions, quizAnswers]
  );

  // Elapsed seconds while taking a quiz without a time limit (exam bar shows it instead).
  const elapsedBase = useMemo(() => {
    if (!startedAt) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  }, [startedAt]);
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    if (!quizStarted || timeRemaining !== null) return;
    const interval = setInterval(() => setNowTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [quizStarted, timeRemaining]);
  const elapsedSeconds = elapsedBase + nowTick;

  const handleGoBack = useGoBack(`/assignments/${assignmentId}`);

  // Helper function to execute quiz submission
  const executeQuizSubmission = async () => {
    // Hide modal if open
    setShowConfirmModal(false);

    const answersPayload = quizQuestions.map((question: QuizQuestion) =>
      buildAnswerPayload(question, quizAnswers[getObjId(question) ?? ''] ?? null)
    );

    const result = await createSubmission({
      assignment_id: assignmentId,
      answers: answersPayload,
      started_at: startedAt || undefined,
    });

    if (result.success) {
      clearQuizDraft();
      const successMessage = result.message || "Nộp bài trắc nghiệm thành công";
      addToast({ type: "success", title: successMessage });
      setTimeout(() => {
        router.push(`/assignments/${assignmentId}`);
      }, 1000);
    } else {
      addToast({ type: "error", title: result.message || "Lỗi khi nộp bài" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!assignment) {
      addToast({ type: "error", title: "Không tìm thấy bài tập" });
      return;
    }

    if (isQuizAssignment) {
      if (!quizQuestions || quizQuestions.length === 0) {
        addToast({ type: "error", title: "Không thể tải đề trắc nghiệm. Vui lòng thử lại." });
        return;
      }

      const unanswered = quizQuestions.filter((question: QuizQuestion) =>
        !isQuestionAnswered(question, quizAnswers[getObjId(question) ?? ''] ?? null)
      );

      if (unanswered.length > 0 && !timeExpired) {
        setUnansweredCount(unanswered.length);
        setShowConfirmModal(true);
        return;
      }

      await executeQuizSubmission();
      return;
    }

    // Validate that at least one submission field is provided
    if (!submissionData.content && !submissionData.media_id && !submissionData.external_url) {
      addToast({ type: "error", title: "Vui lòng cung cấp nội dung bài nộp (text, file, hoặc link)" });
      return;
    }

    const result = await createSubmission({
      assignment_id: assignmentId,
      content: submissionData.content || undefined,
      media_id: submissionData.media_id || undefined,
      external_url: submissionData.external_url || undefined,
    });

    if (result.success) {
      const successMessage = result.message || "Nộp bài thành công";
      addToast({ type: "success", title: successMessage });
      setTimeout(() => {
        router.push(`/assignments/${assignmentId}`);
      }, 1000);
    } else {
      if (result.code === 'MAX_ATTEMPTS_EXCEEDED') {
        const errorMessage = result.message || (result.errors
          ? `Bạn đã đạt giới hạn số lần nộp (${result.errors.max_attempts} lần).`
          : "Bạn đã đạt giới hạn số lần nộp");
        addToast({ type: "error", title: errorMessage });
      } else {
        addToast({ type: "error", title: result.message || "Lỗi khi nộp bài" });
      }
    }
  };

  if (assignmentLoading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-24 rounded-lg" />
          <div className="flex-1">
            <Skeleton className="h-8 w-64 rounded mb-2" />
            <Skeleton className="h-4 w-48 rounded" />
          </div>
        </div>

        {/* Info Skeleton */}
        <div className="rounded-lg bg-gray-100 p-4 border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <Skeleton className="h-5 w-48 rounded mb-3" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4 max-w-md rounded" />
            <Skeleton className="h-4 w-1/2 max-w-sm rounded" />
            <Skeleton className="h-4 w-2/3 max-w-md rounded" />
          </div>
        </div>

        {/* Form Skeleton */}
        <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
          <div className="space-y-6">
            <Skeleton className="h-32 w-full rounded-lg" />
            <div className="flex justify-end gap-3">
              <Skeleton className="h-9 w-20 rounded-lg" />
              <Skeleton className="h-9 w-24 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Kiểm tra lock và plan feature trước để ưu tiên hiển thị lock content
  if (actionsLocked || planFeatureMessage) {
    return renderError();
  }

  if (!assignment) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
        <h3 className="font-medium mb-2">Không tìm thấy bài tập</h3>
        <div className="mt-4">
          <Button
            onClick={handleGoBack}
            variant="outline"
            size="sm"
            icon={<ArrowLeftIcon />}
          >
            Quay lại
          </Button>
        </div>
      </div>
    );
  }

  // Check permissions after data loaded - show locked content if no manage permission
  // Only check when data is loaded (not loading) and permissions are available
  // Note: For students, can_manage might be false but they can still submit
  // So we only block if it's explicitly denied AND user is not a student
  if (!assignmentLoading && assignment && permissions !== undefined && !canManage && !isStudentUser) {
    return renderError(undefined, undefined, false);
  }

  const allowedSubmissionTypes = assignment.allowed_submission_types || ['text'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          onClick={handleGoBack}
          variant="outline"
          size="sm"
          icon={<ArrowLeftIcon />}
        >
          Quay lại
        </Button>

        <div className="flex-1">
          <h1 className="text-2xl font-bold text-dark dark:text-white">Nộp bài tập</h1>
          <p className="text-dark-4 dark:text-dark-6 mt-1">
            {assignment.title}
          </p>
        </div>
      </div>

      {/* Assignment info */}
      <div className="rounded-lg bg-primary-pastel/40 border border-primary/30 p-4">
        <h3 className="text-sm font-medium text-primary mb-2">
          Thông tin bài tập
        </h3>
        <div className="space-y-1 text-xs text-primary">
          <p><strong>Lớp học:</strong> {assignment.class?.name || 'N/A'}</p>
          {assignment.due_date && (
            <p><strong>Hạn nộp:</strong> {new Date(assignment.due_date).toLocaleDateString('vi-VN')}</p>
          )}
          <p><strong>Định dạng được phép:</strong> {allowedSubmissionTypes.map((t: string) => {
            const labels: Record<string, string> = {
              text: 'Văn bản',
              file: 'File',
              document: 'Tài liệu',
              image: 'Hình ảnh',
              video: 'Video',
              audio: 'Ghi âm',
              link: 'Liên kết',
              quiz: 'Trắc nghiệm',
            };
            return labels[t] || t;
          }).join(', ')}</p>
          {assignment.max_attempts !== null && assignment.max_attempts !== undefined && (
            <p><strong>Giới hạn số lần nộp:</strong> {assignment.max_attempts} lần</p>
          )}
          {isQuizAssignment && (
            <p className="text-sm text-primary font-semibold">
              ⚡ Bài trắc nghiệm - hệ thống sẽ tự động chấm điểm ngay sau khi nộp.
              {quizSettings?.time_limit_minutes && (
                <span className="ml-1 text-xs text-primary/80">
                  (Thời gian làm bài: {quizSettings.time_limit_minutes} phút)
                </span>
              )}
            </p>
          )}
        </div>
      </div>
      {isStudentPaused && (
        <PausedStudentBanner
          enrollment={pausedEnrollment}
          studentName={user?.name}
          className={assignment.class?.name}
          description="Bạn đang tạm dừng lớp học này nên tạm thời không thể nộp bài."
        />
      )}

      {/* Form */}
      <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
        <form id="quiz-submit-form" onSubmit={handleSubmit} className="space-y-6">
          {createError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
              {createError}
            </div>
          )}

          {isQuizAssignment ? (
            quizTakeLoading ? (
              <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-gray-500 dark:border-gray-700 dark:text-gray-300">
                Đang tải đề trắc nghiệm...
              </div>
            ) : quizTakeError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                {quizTakeError || "Không thể tải đề trắc nghiệm"}
              </div>
            ) : !quizStarted ? (
              // Quiz Info Screen - Before starting
              <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-primary-pastel/20 to-primary-pastel/40 p-8 text-center dark:border-gray-700 dark:from-primary-pastel/10 dark:to-primary-pastel/20">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                  <CheckCircleIcon className="h-10 w-10 text-primary" />
                </div>
                <h3 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
                  Thông tin bài trắc nghiệm
                </h3>
                <div className="mx-auto mb-6 max-w-md space-y-3 text-left text-sm text-gray-700 dark:text-gray-300">
                  <div className="flex items-start gap-3">
                    <CheckCircleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                    <div>
                      <p className="font-medium">Số câu hỏi:</p>
                      <p className="text-gray-600 dark:text-gray-400">{quizQuestions.length} câu</p>
                    </div>
                  </div>
                  {quizSettings?.time_limit_minutes && (
                    <div className="flex items-start gap-3">
                      <ClockIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                      <div>
                        <p className="font-medium">Thời gian làm bài:</p>
                        <p className="text-gray-600 dark:text-gray-400">{quizSettings.time_limit_minutes} phút</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <CheckCircleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                    <div>
                      <p className="font-medium">Tổng điểm:</p>
                      <p className="text-gray-600 dark:text-gray-400">
                        {quizQuestions.reduce((sum: number, q: QuizQuestion) => sum + (Number(q.points) || 0), 0)} điểm
                      </p>
                    </div>
                  </div>
                  {quizSettings?.auto_grade && (
                    <div className="flex items-start gap-3">
                      <CheckCircleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                      <div>
                        <p className="font-medium">Chấm điểm tự động:</p>
                        <p className="text-gray-600 dark:text-gray-400">Có - Kết quả sẽ được hiển thị ngay sau khi nộp</p>
                      </div>
                    </div>
                  )}
                  {quizSettings?.shuffle_questions && (
                    <div className="flex items-start gap-3">
                      <CheckCircleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                      <div>
                        <p className="font-medium">Xáo trộn câu hỏi:</p>
                        <p className="text-gray-600 dark:text-gray-400">Có</p>
                      </div>
                    </div>
                  )}
                  {assignment.max_attempts !== null && assignment.max_attempts !== undefined && (
                    <div className="flex items-start gap-3">
                      <CheckCircleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                      <div>
                        <p className="font-medium">Giới hạn số lần nộp:</p>
                        <p className="text-gray-600 dark:text-gray-400">
                          {attemptsInfo
                            ? attemptsInfo.unlimited
                              ? `Đã nộp ${attemptsInfo.current} lần (Không giới hạn)`
                              : attemptsInfo.limit_reached
                                ? `Đã đạt giới hạn (${attemptsInfo.current}/${attemptsInfo.max} lần)`
                                : `${attemptsInfo.current}/${attemptsInfo.max} lần (Còn lại: ${attemptsInfo.remaining} lần)`
                            : `${assignment.max_attempts} lần`}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-8">
                  {limitReached ? (
                    <Button
                      type="button"
                      disabled
                      variant="secondary"
                      size="lg"
                      icon={<PlayIcon />}
                      className="px-8"
                    >
                      Đã đạt giới hạn số lần nộp
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={handleStartQuiz}
                      variant="primary"
                      size="lg"
                      icon={<PlayIcon />}
                      className="px-8"
                    >
                      Bắt đầu làm bài
                    </Button>
                  )}
                </div>
                <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                  {quizSettings?.time_limit_minutes
                    ? `Khi bấm "Bắt đầu làm bài", đồng hồ đếm ngược sẽ bắt đầu và bạn cần hoàn thành bài làm trong ${quizSettings.time_limit_minutes} phút.`
                    : 'Khi bấm "Bắt đầu làm bài", bạn sẽ bắt đầu làm bài trắc nghiệm.'}
                </p>
              </div>
            ) : (
              // Quiz Form - After starting
              <div className="space-y-6">
                {/* Timer */}
                {quizSettings?.time_limit_minutes && timeRemaining !== null && (
                  <div className="sticky top-4 z-10 flex justify-center">
                    <div className={`inline-flex rounded-lg border-2 px-6 py-4 ${timeRemaining <= 60
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                      : timeRemaining <= 300
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                        : 'border-primary bg-primary-pastel/40'
                      }`}>
                      <div className="flex items-center gap-4">
                        <ClockIcon className={`h-6 w-6 flex-shrink-0 ${timeRemaining <= 60
                          ? 'text-red-600 dark:text-red-400'
                          : timeRemaining <= 300
                            ? 'text-orange-600 dark:text-orange-400'
                            : 'text-primary'
                          }`} />
                        <div className="flex items-center gap-4">
                          <div>
                            <p className={`text-xs font-medium ${timeRemaining <= 60
                              ? 'text-red-600 dark:text-red-400'
                              : timeRemaining <= 300
                                ? 'text-orange-600 dark:text-orange-400'
                                : 'text-primary'
                              }`}>
                              {timeExpired ? 'Hết thời gian' : 'Thời gian còn lại'}
                            </p>
                            <p className={`text-2xl font-bold ${timeRemaining <= 60
                              ? 'text-red-700 dark:text-red-300'
                              : timeRemaining <= 300
                                ? 'text-orange-700 dark:text-orange-300'
                                : 'text-primary'
                              }`}>
                              {formatTime(timeRemaining)}
                            </p>
                          </div>
                          {timeExpired && (
                            <p className="text-sm font-medium text-red-600 dark:text-red-400 whitespace-nowrap">
                              Đang tự động nộp bài...
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Answer progress: answered / total across all sections */}
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <CheckCircleIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                  Đã trả lời {answeredCount}/{quizQuestions.length} câu
                </div>

                {/* Question palette: click a card to jump to that question */}
                {quizQuestions.length > 0 && (
                  <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      Bảng câu hỏi
                    </p>
                    <QuizSectionNavigator
                      mode="take"
                      {...buildTakeNavigator(quizSections, quizQuestions, (questionId: string) =>
                        isQuestionAnswered(
                          quizQuestions.find((q: QuizQuestion) => getObjId(q) === questionId) as QuizQuestion,
                          quizAnswers[questionId] ?? null
                        )
                      )}
                    />
                  </div>
                )}

                {/* Sections render in exam order; a flat quiz falls back to a single group */}
                {questionGroups.map(({ section, questions: groupQuestions }, groupIndex) => {
                  const startIndex = questionGroups
                    .slice(0, groupIndex)
                    .reduce((sum, g) => sum + g.questions.length, 0);

                  return (
                    <div
                      key={section?._id || `flat-${groupIndex}`}
                      id={section ? `quiz-section-${section._id}` : undefined}
                      className="space-y-4"
                    >
                      {section ? (
                        <div className="rounded-2xl border border-primary/30 bg-primary-pastel/30 p-4 dark:border-primary/40 dark:bg-primary/10">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <h3 className="text-base font-bold text-primary">
                                {section.title}
                              </h3>
                              {section.instruction ? (
                                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                                  {section.instruction}
                                </p>
                              ) : null}
                            </div>
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-primary dark:bg-gray-800">
                              {groupQuestions.length} câu
                            </span>
                          </div>
                          <QuizMediaDisplay media={section.media} variant="section" />
                        </div>
                      ) : null}
                      <QuizTakeForm
                        questions={groupQuestions}
                        answers={quizAnswers}
                        onChange={(questionId, value) =>
                          setQuizAnswers((prev) => ({ ...prev, [questionId]: value }))
                        }
                        disabled={createLoading || timeExpired}
                        startIndex={startIndex}
                      />
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <DynamicSubmissionForm
              allowedSubmissionTypes={allowedSubmissionTypes}
              assignmentId={assignmentId}
              value={submissionData}
              onChange={setSubmissionData}
            />
          )}

          {isQuizAssignment && quizStarted && !timeExpired && (
            <div className="flex items-center justify-end gap-4 pt-4">
              <ButtonLink
                href={`/assignments/${assignmentId}`}
                variant="outline"
                size="sm"
              >
                Hủy
              </ButtonLink>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={createLoading}
                icon={<DocumentArrowUpIcon />}
              >
                Nộp bài
              </Button>
            </div>
          )}

          {!isQuizAssignment && (
            <div className="flex items-center justify-end gap-4 pt-4">
              <ButtonLink
                href={`/assignments/${assignmentId}`}
                variant="outline"
                size="sm"
              >
                Hủy
              </ButtonLink>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={createLoading}
                icon={<DocumentArrowUpIcon />}
              >
                Nộp bài
              </Button>
            </div>
          )}
        </form>
      </div>

      {/* Sticky exam bar (wireframe trang 21): timer/elapsed + progress + submit, ẩn khi hết giờ */}
      {isQuizAssignment && quizStarted && (
        <QuizExamBar
          timeRemaining={timeRemaining}
          timeExpired={timeExpired}
          elapsedSeconds={timeRemaining === null ? elapsedSeconds : null}
          answered={answeredCount}
          total={quizQuestions.length}
          submitting={createLoading}
        />
      )}
      {isQuizAssignment && quizStarted && <div className="h-20" aria-hidden="true" />}


      {/* Confirmation Modal */}
      {isConfirmPortalReady && showConfirmModal &&
        createPortal(
          <div className="fixed inset-0 flex items-center justify-center z-[1000] bg-black/50 backdrop-blur-[1px] px-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Chưa hoàn thành</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Bạn còn <strong className="text-amber-600 dark:text-amber-500">{unansweredCount}</strong> câu hỏi chưa trả lời.
                <br />
                Bạn có chắc chắn muốn nộp bài ngay không?
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={createLoading}
                  type="button"
                >
                  Kiểm tra lại
                </button>
                <button
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
                  onClick={executeQuizSubmission}
                  disabled={createLoading}
                  type="button"
                >
                  {createLoading ? "Đang nộp..." : "Nộp bài luôn"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      }
    </div >
  );
}
