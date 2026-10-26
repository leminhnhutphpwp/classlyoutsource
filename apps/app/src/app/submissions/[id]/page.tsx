"use client";
import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useSubmission, useGradeSubmission, useUpdateSubmission, useDeleteSubmission, useSubmissionHistory, useStudentClasses, useAssignmentQuizSchema, useAiGradeSubmission, useAcceptAiGrade, aiGradeAcceptErrorMessage, useAiAccess, useSubmissionReview } from "@/hooks/use-api";
import type { AiGradeSuggestion } from "@/lib/api-config";
import { useGoBack } from "@/hooks/use-go-back";
import { useAuthContext } from "@/contexts/auth-context";
import { useNotification } from "@/hooks/use-notification";
import { useStudentId } from "@/hooks/use-student-id";
import { isStudent } from "@/lib/authz";

import ConfirmDeleteDialog from '@/components/Common/ConfirmDeleteDialog';
import PausedStudentBanner from "@/components/Students/PausedStudentBanner";
import Button from "@/components/Common/Button";
import ButtonLink from "@/components/Common/ButtonLink";
import { formatScore } from "@/lib/format-score";
import ErrorDisplay from "@/components/Common/ErrorDisplay";
import {
  ArrowLeftIcon,
  UserIcon,
  DocumentTextIcon,
  CalendarIcon,
  ClockIcon,
  AcademicCapIcon,
  CheckCircleIcon,
  XCircleIcon,
  PaperClipIcon,
  PencilIcon,
  TrashIcon,
  ChartBarIcon,
  SparklesIcon
} from "@heroicons/react/24/outline";
import { getObjId, idsEqual } from "@/lib/id-utils";
import QuizReviewPanel from "@/components/Assignments/question-types/QuizReviewPanel";
import QuizManualGrading from "@/components/Assignments/question-types/QuizManualGrading";
import QuizSectionNavigator, { buildReviewNavigator } from "@/components/Assignments/question-types/QuizSectionNavigator";
import QuizScoreReport from "@/components/Assignments/question-types/QuizScoreReport";
import ScoreConversionCard from "@/components/Assignments/question-types/ScoreConversionCard";
import type { QuizReviewPayload } from "@/lib/api-config";

export default function SubmissionDetailsPage() {
  const params = useParams();
  const submissionId = params.id as string;
  const { user } = useAuthContext();
  const { success, error: showError } = useNotification();
  const [showGradeForm, setShowGradeForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [gradeData, setGradeData] = useState({
    grade: '',
    feedback: ''
  });
  const [aiSuggestion, setAiSuggestion] = useState<AiGradeSuggestion | null>(null);

  // Use browser history navigation
  const handleGoBack = useGoBack('/submissions');

  const { data: submission, loading, error, refetch } = useSubmission(submissionId);
  const { mutate: gradeSubmission, loading: grading } = useGradeSubmission();
  useUpdateSubmission();
  const { mutate: deleteSubmission, loading: deleting } = useDeleteSubmission();
  const { mutate: aiGradeSubmission, loading: aiGrading } = useAiGradeSubmission();
  const { mutate: acceptAiGrade, loading: acceptingAi } = useAcceptAiGrade();
  const { canUseAi } = useAiAccess();

  // Get submission history if we have assignment
  const assignmentId = submission?.assignment_id?.toString() || (submission?.assignment && getObjId(submission.assignment));
  const submissionStudentId = submission?.student_id?.toString();
  const { data: submissionHistory } = useSubmissionHistory(
    assignmentId || "",
    submissionStudentId,
    !!assignmentId && !!submissionStudentId
  );

  // Fetch quiz schema if this is a quiz submission
  const isQuizSubmission = submission?.assignment?.mode === 'quiz';
  const { data: quizSchema } = useAssignmentQuizSchema(assignmentId || '', isQuizSubmission && !!assignmentId);

  // Full paper review (sections + questions + the student's answers). Works for the owning
  // student AND staff; the backend gates the answer key on quiz_settings.show_correct_answers.
  const { data: reviewData, refetch: refetchReview } = useSubmissionReview(submissionId, isQuizSubmission);
  const quizReview = reviewData?.data as QuizReviewPayload | undefined;

  // Check if user is tutor (can grade submissions)
  const isTutor = user?.role === 'tutor' || user?.is_tutor;

  // Check if user is the student who submitted
  const isStudentOwner = user?.role === 'student' && idsEqual(submission?.student?.user_id, user);

  // Check enrollment status for students
  const isStudentUser = isStudent(user);
  const { studentId } = useStudentId();
  const shouldLoadStudentClasses = isStudentUser && !!studentId;
  const { classes: studentClasses, loading: studentClassesLoading } = useStudentClasses(
    studentId || '0',
    undefined,
    { enabled: shouldLoadStudentClasses }
  );

  // Get class_id from submission
  const submissionClassId = submission?.class_id ||
    submission?.assignment?.class_id ||
    (submission?.assignment?.class && getObjId(submission.assignment.class)) ||
    (submission?.class && getObjId(submission.class));

  // Find enrollment for the class
  const pausedEnrollment = useMemo(() => {
    if (!isStudentUser || !submissionClassId || !studentClasses?.length) return null;
    if (shouldLoadStudentClasses && studentClassesLoading) return null;

    const targetClass = studentClasses.find((cls: any) => {
      const identifier = getObjId(cls.class_id || cls.class || cls.pivot?.class_id || cls);
      return idsEqual(identifier, submissionClassId);
    });

    return targetClass?.enrollment || targetClass?.pivot || null;
  }, [isStudentUser, submissionClassId, studentClasses, shouldLoadStudentClasses, studentClassesLoading]);

  const isStudentPaused = isStudentUser && !!pausedEnrollment?.is_paused;

  const handleGradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradeData.grade || !submission) return;

    const maxScore = submission.max_score || submission.assignment?.max_score || 100;
    const grade = parseFloat(gradeData.grade);

    if (grade < 0 || grade > maxScore) {
      showError(`Điểm phải từ 0 đến ${maxScore}`);
      return;
    }

    const result = await gradeSubmission(submissionId, {
      score: grade,
      feedback: gradeData.feedback.trim() || undefined
    });

    if (result.success) {
      success('Chấm bài thành công!');
      setShowGradeForm(false);
      setGradeData({ grade: '', feedback: '' });
      refetch();
    }
  };

  // AI grading only makes sense when there is free-text / short-answer content to assess
  // (mirrors the backend's NO_FREE_TEXT guard).
  const hasFreeTextToGrade = !!(submission?.content && submission.content.trim())
    || (submission?.quiz_breakdown?.details || []).some(
      (d: any) => typeof d?.text_answer === 'string' && d.text_answer.trim().length > 0
    );

  const handleAiGrade = async () => {
    const result = await aiGradeSubmission(submissionId);

    if (result.success && result.data?.suggestion) {
      setAiSuggestion(result.data.suggestion);
      success('AI đã đưa ra gợi ý chấm điểm. Vui lòng xem lại trước khi lưu điểm chính thức.');
      // Keep the stored suggestion (ai_graded_at) in sync on the page.
      refetch();
    } else if (!result.success && result.code !== 'FEATURE_NOT_AVAILABLE') {
      // Feature denials already surface a permission message; other AI errors get a toast.
      showError('Không thể chấm bằng AI', result.message);
    }
  };

  const applyAiScore = () => {
    if (!aiSuggestion) return;
    setGradeData(prev => ({ ...prev, grade: String(aiSuggestion.score) }));
    setShowGradeForm(true);
  };

  const applyAiFeedback = () => {
    if (!aiSuggestion) return;
    setGradeData(prev => ({ ...prev, feedback: aiSuggestion.feedback || '' }));
    setShowGradeForm(true);
  };

  // Accept the AI suggestion as the official grade. If the tutor has edited the grade form
  // (score/feedback), send those edits; otherwise accept the suggestion as-is (empty body).
  const handleAcceptAiGrade = async () => {
    if (!aiSuggestion || !submission) return;

    const maxScore = submission.max_score || submission.assignment?.max_score || aiSuggestion.max_points || 100;
    const payload: { score?: number; feedback?: string } = {};

    if (gradeData.grade.trim() !== '') {
      const grade = parseFloat(gradeData.grade);
      if (Number.isNaN(grade) || grade < 0 || grade > maxScore) {
        showError(`Điểm phải từ 0 đến ${maxScore}`);
        return;
      }
      payload.score = grade;
    }
    if (gradeData.feedback.trim() !== '') {
      payload.feedback = gradeData.feedback.trim();
    }

    const result = await acceptAiGrade(submissionId, Object.keys(payload).length ? payload : undefined);

    if (result.success) {
      success('Đã áp dụng điểm của AI làm điểm chính thức.');
      setAiSuggestion(null);
      setShowGradeForm(false);
      setGradeData({ grade: '', feedback: '' });
      refetch();
    } else if (result.code !== 'FEATURE_NOT_AVAILABLE') {
      // Feature denials already surface a permission message; other errors get a mapped toast.
      showError('Không thể áp dụng gợi ý của AI', aiGradeAcceptErrorMessage(result.code, result.message));
    }
  };

  const aiConfidence = typeof aiSuggestion?.confidence === 'number' ? aiSuggestion.confidence : null;
  const aiConfidencePct = aiConfidence !== null ? Math.round(aiConfidence * 100) : null;
  const isLowConfidence = aiConfidence !== null && aiConfidence < 0.6;

  const handleDelete = async () => {
    const result = await deleteSubmission(submissionId);
    if (result.success) {
      success('Xóa bài nộp thành công!');
      handleGoBack();
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-10 w-24 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="flex-1">
            <div className="h-8 w-64 rounded bg-gray-200 dark:bg-gray-700 animate-pulse mb-2" />
            <div className="h-4 w-48 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
          </div>
        </div>
        <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
          <div className="space-y-4">
            <div className="h-6 w-48 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-10 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !loading) {
    return <ErrorDisplay error={error} title="Lỗi tải dữ liệu bài nộp" onRetry={() => refetch()} />;
  }

  const getStatusBadge = (status: string, isLate?: boolean) => {
    if (isLate) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-[var(--status-badge-error)] text-[var(--status-badge-error-text)]">
          <XCircleIcon className="h-4 w-4 mr-1" />
          Nộp muộn
        </span>
      );
    }
    switch (status) {
      case 'graded':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]">
            <CheckCircleIcon className="h-4 w-4 mr-1" />
            Đã chấm
          </span>
        );
      case 'submitted':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-[var(--status-badge-completed)] text-[var(--status-badge-completed-text)]">
            Đã nộp
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-[var(--status-badge-pending)] text-[var(--status-badge-pending-text)]">
            Chưa nộp
          </span>
        );
    }
  };

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
          <h1 className="text-2xl font-bold text-dark dark:text-white">
            Chi tiết bài nộp
          </h1>
          {submission.assignment && (
            <p className="text-dark-4 dark:text-dark-6 mt-1">
              Bài tập: {submission.assignment.title}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(submission.status, submission.is_late)}
          {/* Action buttons */}
          <div className="flex items-center gap-2 ml-2">
            {/* Student actions - can only resubmit, not edit */}
            {isStudentOwner && submission.assignment && (() => {
              const attemptsInfo = submission.attempts_info;
              const assignment = submission.assignment;
              const assignmentId = submission.assignment_id || (assignment && getObjId(assignment));

              // Check if can resubmit based on attempts
              const canResubmitByAttempts = attemptsInfo?.can_resubmit && !attemptsInfo?.limit_reached;

              // Check if assignment allows late submission
              const allowLateSubmission = assignment?.allow_late_submission !== false; // Default to true if not specified

              // Check if due date has passed
              let isPastDue = false;
              if (assignment?.due_date) {
                const dueDate = new Date(assignment.due_date);
                const now = new Date();
                // Also check deadline if exists
                if (assignment?.deadline) {
                  const deadline = new Date(assignment.deadline);
                  isPastDue = deadline < now;
                } else {
                  // If no deadline, use end of due_date
                  dueDate.setHours(23, 59, 59, 999);
                  isPastDue = dueDate < now;
                }
              }

              // Can resubmit only if:
              // 1. Not reached attempt limit AND
              // 2. (Not past due date OR allow late submission)
              const canResubmit = canResubmitByAttempts && (!isPastDue || allowLateSubmission);

              if (canResubmit) {
                return (
                  <Link
                    href={`/assignments/${assignmentId}/submit`}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
                  >
                    <PencilIcon className="h-4 w-4" />
                    Nộp lại bài
                  </Link>
                );
              }
              return null;
            })()}

            {/* Tutor actions - can edit and delete */}
            {isTutor && submission.status === 'submitted' && (
              <>
                <ButtonLink
                  href={`/submissions/${submissionId}/edit`}
                  variant="outline"
                  size="sm"
                  icon={<PencilIcon />}
                >
                  Chỉnh sửa
                </ButtonLink>
                <Button
                  onClick={() => setShowDeleteConfirm(true)}
                  variant="danger"
                  size="sm"
                  icon={<TrashIcon />}
                >
                  Xóa
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Paused Student Banner */}
      {isStudentPaused && pausedEnrollment && (
        <PausedStudentBanner
          enrollment={pausedEnrollment}
          studentName={user?.name}
          className={submission?.class?.name || submission?.assignment?.class?.name}
          description="Bạn đang tạm dừng lớp này nên chỉ có thể xem thông tin. Liên hệ giáo viên để mở lại nếu cần tiếp tục học."
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        message="Bạn có chắc chắn muốn xóa bài nộp này? Hành động này không thể hoàn tác."
        loading={deleting}
      />

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quiz Results Overview - Only for quiz submissions */}
          {submission.assignment?.mode === "quiz" && submission.quiz_breakdown && (
            <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
              <h3 className="text-lg font-semibold text-primary dark:text-primary mb-6 flex items-center gap-2">
                <ChartBarIcon className="h-5 w-5 text-primary" />
                Tổng quan kết quả bài làm trắc nghiệm
              </h3>

              {/* Statistics Cards */}
              {(() => {
                const breakdown = submission.quiz_breakdown;
                const totalQuestions = breakdown.total_questions || 0;
                const correctCount = breakdown.correct || 0;
                const incorrectCount = totalQuestions - correctCount;
                const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
                const totalScore = submission.score || 0;
                const maxScore = submission.max_score || submission.assignment?.max_score || 0;

                // Check if should show correct answers
                // Tutors can always see, students only if show_correct_answers is true
                const quizSettings = submission.assignment?.quiz?.settings || quizSchema?.settings;

                // Time information
                const timeSpentMinutes = submission.time_spent_minutes;
                const timeLimitMinutes = quizSettings?.time_limit_minutes;

                return (
                  <div className="space-y-6">
                    {/* Time Information */}
                    {timeSpentMinutes !== null && (
                      <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 dark:bg-gray-800 dark:border-gray-700">
                        <div className="flex items-center gap-2">
                          <ClockIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                          <div>
                            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Thời gian làm bài</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {timeSpentMinutes} phút
                              {timeLimitMinutes && (
                                <span className="text-gray-500 dark:text-gray-400 ml-1">
                                  / {timeLimitMinutes} phút
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {/* Total score */}
                      <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 dark:bg-gray-800 dark:border-gray-700">
                        <p className="text-xs font-medium text-primary mb-1">Tổng điểm</p>
                        <p className="text-2xl font-bold text-primary">
                          {Number(parseFloat(totalScore.toString()).toFixed(1))}/{Number(parseFloat(maxScore.toString()).toFixed(0))}
                        </p>
                      </div>
                      {/* Correct count */}
                      <div className="rounded-lg bg-green-50 border border-green-200 p-4 dark:bg-green-900/20 dark:border-green-800">
                        <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">Câu đúng</p>
                        <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                          {correctCount}
                        </p>
                      </div>
                      {/* Incorrect count */}
                      <div className="rounded-lg bg-red-50 border border-red-200 p-4 dark:bg-red-900/20 dark:border-red-800">
                        <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-1">Câu sai</p>
                        <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                          {incorrectCount}
                        </p>
                      </div>
                      {/* Accuracy */}
                      <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 dark:bg-gray-800 dark:border-gray-700">
                        <p className="text-xs font-medium text-primary mb-1">Tỷ lệ đúng</p>
                        <p className="text-2xl font-bold text-primary">
                          {percentage}%
                        </p>
                      </div>
                    </div>

                    {/* Questions List — full paper review (sections + per-type answers + answer key).
                        The panel renders every question type through the question-type registry. */}
                    <div className="space-y-4">
                      <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                        Chi tiết từng câu hỏi
                      </h4>
                      {quizReview?.questions && quizReview.questions.length > 0 ? (
                        <>
                          <QuizScoreReport review={quizReview} />
                          <ScoreConversionCard />
                          {isTutor && <QuizManualGrading review={quizReview} onGraded={refetchReview} />}
                          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                              Bảng câu hỏi
                            </p>
                            <QuizSectionNavigator mode="review" {...buildReviewNavigator(quizReview)} />
                          </div>
                          <QuizReviewPanel review={quizReview} />
                        </>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Đang tải chi tiết bài làm...
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Submission Content */}
          <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Nội dung bài làm
            </h3>
            {submission.content ? (
              <div className="prose max-w-none text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {submission.content}
              </div>
            ) : submission.assignment?.mode === 'quiz' ? (
              <p className="text-gray-500 dark:text-gray-400 italic">Bài làm trắc nghiệm - xem kết quả ở trên</p>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 italic">Chưa có nội dung</p>
            )}
          </div>

          {/* Attachments */}
          {submission.file_path && (
            <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <PaperClipIcon className="h-5 w-5" />
                Tệp đính kèm
              </h3>
              <div className="flex items-center gap-3">
                <PaperClipIcon className="h-5 w-5 text-gray-400" />
                <a
                  href={submission.file_path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {submission.file_path.split('/').pop() || 'Tệp đính kèm'}
                </a>
              </div>
            </div>
          )}

          {/* Feedback */}
          {submission.feedback && (
            <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Nhận xét
              </h3>
              <div className="prose max-w-none text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {submission.feedback}
              </div>
            </div>
          )}

          {/* Grade Form - Only for tutors when not graded */}
          {isTutor && submission.status !== 'graded' && (
            <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Chấm bài
                </h3>
                <div className="flex items-center gap-2">
                  {/* AI grading suggestion — Pro only, and only when there's free-text to grade */}
                  {canUseAi && hasFreeTextToGrade && (
                    <button
                      type="button"
                      onClick={handleAiGrade}
                      disabled={aiGrading}
                      className="inline-flex items-center gap-2 rounded-lg border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50 dark:border-violet-500/40 dark:bg-violet-900/20 dark:text-violet-200 dark:hover:bg-violet-900/30"
                    >
                      <SparklesIcon className="h-4 w-4" />
                      {aiGrading ? 'AI đang chấm...' : 'Gợi ý chấm bằng AI'}
                    </button>
                  )}
                  {!showGradeForm && (
                    <button
                      onClick={() => setShowGradeForm(true)}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
                    >
                      <AcademicCapIcon className="h-4 w-4" />
                      Chấm bài
                    </button>
                  )}
                </div>
              </div>

              {/* AI suggestion card — clearly a suggestion, not the final grade */}
              {aiSuggestion && (
                <div className="mb-4 rounded-lg border border-violet-200 bg-violet-50/70 p-4 dark:border-violet-500/40 dark:bg-violet-900/20">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                      <SparklesIcon className="h-3.5 w-3.5" />
                      AI gợi ý
                    </span>
                    {/* Confidence — warn (amber) when the model is unsure so the tutor double-checks */}
                    {aiConfidencePct !== null && (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${isLowConfidence
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                          : 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200'
                          }`}
                      >
                        Độ tự tin: {aiConfidencePct}%
                      </span>
                    )}
                    <span className="text-xs text-violet-700 dark:text-violet-300">
                      Đây chỉ là gợi ý — bạn vẫn cần xem lại trước khi áp dụng.
                    </span>
                  </div>

                  {isLowConfidence && (
                    <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                      ⚠️ AI chưa chắc chắn về gợi ý này. Vui lòng xem kỹ trước khi áp dụng làm điểm chính thức.
                    </p>
                  )}

                  <div className="flex flex-wrap items-baseline gap-2 mb-3">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Điểm đề xuất:</span>
                    <span className="text-2xl font-bold text-violet-700 dark:text-violet-200">
                      {aiSuggestion.score}
                      <span className="text-base font-medium text-gray-500 dark:text-gray-400">
                        /{aiSuggestion.max_points}
                      </span>
                    </span>
                  </div>

                  {/* Rubric / criteria breakdown */}
                  {aiSuggestion.criteria && aiSuggestion.criteria.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Đánh giá theo tiêu chí:</p>
                      <ul className="space-y-2">
                        {aiSuggestion.criteria.map((c, i) => (
                          <li
                            key={`${c.name}-${i}`}
                            className="rounded-md border border-violet-200/70 bg-white/60 p-2.5 dark:border-violet-500/30 dark:bg-gray-800/40"
                          >
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{c.name}</span>
                              <span className="shrink-0 text-sm font-semibold text-violet-700 dark:text-violet-200">
                                {c.score}
                              </span>
                            </div>
                            {c.comment && (
                              <p className="mt-1 whitespace-pre-wrap text-xs text-gray-600 dark:text-gray-300">
                                {c.comment}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {aiSuggestion.feedback && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Nhận xét đề xuất:</p>
                      <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200">
                        {aiSuggestion.feedback}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Accept the AI grade as the official score (uses form edits when present) */}
                    <button
                      type="button"
                      onClick={handleAcceptAiGrade}
                      disabled={acceptingAi}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                    >
                      <CheckCircleIcon className="h-4 w-4" />
                      {acceptingAi ? 'Đang áp dụng...' : 'Dùng gợi ý AI'}
                    </button>
                    <button
                      type="button"
                      onClick={applyAiScore}
                      className="rounded-lg border border-violet-300 px-3 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-100 dark:border-violet-500/40 dark:text-violet-200 dark:hover:bg-violet-900/30"
                    >
                      Sửa điểm này
                    </button>
                    {aiSuggestion.feedback && (
                      <button
                        type="button"
                        onClick={applyAiFeedback}
                        className="rounded-lg border border-violet-300 px-3 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-100 dark:border-violet-500/40 dark:text-violet-200 dark:hover:bg-violet-900/30"
                      >
                        Sửa nhận xét
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setAiSuggestion(null)}
                      className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                    >
                      Bỏ qua
                    </button>
                  </div>
                </div>
              )}

              {showGradeForm && (
                <form onSubmit={handleGradeSubmit} className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                      Điểm số <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={submission.max_score || submission.assignment?.max_score || 100}
                      value={gradeData.grade}
                      onChange={(e) => setGradeData(prev => ({ ...prev, grade: e.target.value }))}
                      placeholder="Nhập điểm số"
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-primary"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Tối đa: {submission.max_score || submission.assignment?.max_score || 'N/A'}
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                      Nhận xét (tùy chọn)
                    </label>
                    <textarea
                      value={gradeData.feedback}
                      onChange={(e) => setGradeData(prev => ({ ...prev, feedback: e.target.value }))}
                      placeholder="Nhập nhận xét cho học viên..."
                      rows={4}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-primary"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={grading}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                    >
                      {grading ? 'Đang chấm...' : 'Lưu điểm'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowGradeForm(false);
                        setGradeData({ grade: '', feedback: '' });
                      }}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      Hủy
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Right Column - Sidebar Info */}
        <div className="space-y-6">
          {/* Student Info */}
          <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Học viên
            </h3>
            {submission.student ? (
              <Link
                href={`/students/${getObjId(submission.student)}`}
                className="flex items-center gap-3 hover:underline"
              >
                <div className="size-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  <UserIcon className="h-6 w-6 text-gray-500 dark:text-gray-400" />
                </div>
                <div>
                  <p className="text-gray-900 dark:text-white font-medium">
                    {submission.student.name}
                  </p>
                  {submission.student.email && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {submission.student.email}
                    </p>
                  )}
                </div>
              </Link>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">Chưa có thông tin</p>
            )}
          </div>

          {/* Assignment Info */}
          {submission.assignment && (
            <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Bài tập
              </h3>
              <Link
                href={`/assignments/${getObjId(submission.assignment)}`}
                prefetch={true}
                className="group flex items-center gap-3 hover:underline transition-all duration-200 hover:opacity-80 cursor-pointer"
              >
                <div className="size-12 rounded-full bg-primary-pastel/40 flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
                  <DocumentTextIcon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-gray-900 dark:text-white font-medium">
                    {submission.assignment.title}
                  </p>
                  {submission.assignment.class && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {submission.assignment.class.name}
                    </p>
                  )}
                </div>
              </Link>
            </div>
          )}

          {/* Submission Details */}
          <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Thông tin
            </h3>
            <div className="space-y-4">
              {submission.submitted_at && (
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    Ngày nộp
                  </p>
                  <p className="text-gray-900 dark:text-white">
                    {new Date(submission.submitted_at).toLocaleString('vi-VN')}
                  </p>
                </div>
              )}

              {(submission.score !== null && submission.score !== undefined) && (
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-2">
                    <AcademicCapIcon className="h-4 w-4" />
                    Điểm
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatScore(submission.score, submission.max_score)}
                  </p>
                </div>
              )}

              {submission.graded_at && (
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-2">
                    <ClockIcon className="h-4 w-4" />
                    Ngày chấm
                  </p>
                  <p className="text-gray-900 dark:text-white">
                    {new Date(submission.graded_at).toLocaleString('vi-VN')}
                  </p>
                </div>
              )}

              {submission.grader && (
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Người chấm
                  </p>
                  <p className="text-gray-900 dark:text-white">
                    {submission.grader.name || submission.grader.email || 'N/A'}
                  </p>
                </div>
              )}

              {submission.attempts_info && (
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Số lần nộp
                  </p>
                  <div className="space-y-1">
                    {submission.attempts_info.unlimited ? (
                      <p className="text-gray-900 dark:text-white">
                        Đã nộp {submission.attempts_info.current} lần (Không giới hạn)
                      </p>
                    ) : (
                      <>
                        <p className="text-gray-900 dark:text-white">
                          {submission.attempts_info.current}/{submission.attempts_info.max} lần
                        </p>
                        {submission.attempts_info.limit_reached ? (
                          <p className="text-sm font-medium text-red-600 dark:text-red-400">
                            ⚠️ Đã đạt giới hạn
                          </p>
                        ) : (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Còn lại: {submission.attempts_info.remaining} lần
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Submission History */}
          {submissionHistory && submissionHistory.length > 1 && (
            <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Lịch sử các lần nộp ({submissionHistory.length} lần)
              </h3>
              <div className="space-y-3">
                {submissionHistory.map((hist: any) => {
                  const isCurrent = getObjId(hist) === getObjId(submission);
                  return (
                    <Link
                      key={getObjId(hist)}
                      href={`/submissions/${getObjId(hist)}`}
                      className={`block rounded-lg border p-4 transition-colors ${isCurrent
                        ? 'border-primary bg-primary/5 dark:bg-primary/10'
                        : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-full ${isCurrent
                            ? 'bg-primary text-white'
                            : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                            {hist.attempt_number}
                          </div>
                          <div>
                            <p className={`text-sm font-medium ${isCurrent
                              ? 'text-primary dark:text-primary-400'
                              : 'text-gray-900 dark:text-white'
                              }`}>
                              Lần nộp {hist.attempt_number}
                              {isCurrent && ' (Hiện tại)'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {hist.submitted_at && new Date(hist.submitted_at).toLocaleString('vi-VN')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {hist.status === 'graded' && hist.score !== null && (
                            <span className="text-sm font-semibold text-primary">
                              {parseFloat(hist.score).toFixed(1)} điểm
                            </span>
                          )}
                          {hist.status === 'graded' && (
                            <CheckCircleIcon className="h-5 w-5 text-primary" />
                          )}
                          {hist.status === 'submitted' && (
                            <span className="text-xs text-primary">Đã nộp</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

