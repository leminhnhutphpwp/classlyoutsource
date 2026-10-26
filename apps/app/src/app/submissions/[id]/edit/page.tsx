"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSubmission, useUpdateSubmission, useAssignment } from "@/hooks/use-api";
import { useGoBack } from "@/hooks/use-go-back";
import { useAuthContext } from "@/contexts/auth-context";
import { useNotification } from "@/hooks/use-notification";
import { isStudent } from "@/lib/authz";
import DynamicSubmissionForm from "@/components/FormElements/DynamicSubmissionForm";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { getObjId } from "@/lib/id-utils";

export default function EditSubmissionPage() {
  const params = useParams();
  const router = useRouter();
  const submissionId = params.id as string;
  const { user } = useAuthContext();
  const { success, error: showError } = useNotification();

  const [submissionData, setSubmissionData] = useState<{
    content?: string;
    media_id?: string;
    external_url?: string;
  }>({
    content: '',
    media_id: undefined,
    external_url: '',
  });

  const { data: submission, loading } = useSubmission(submissionId);
  const { mutate: updateSubmission, loading: updating } = useUpdateSubmission();

  // Get assignment to know allowed_submission_types
  // Only fetch assignment if we have a valid assignmentId (not "0" or undefined)
  const assignmentId = submission?.assignment_id?.toString() || (submission?.assignment && getObjId(submission.assignment));
  const shouldFetchAssignment = !!assignmentId && assignmentId !== "0";
  const { data: assignment } = useAssignment(assignmentId || "", shouldFetchAssignment);

  // Redirect students to submit page (they can't edit, only resubmit)
  useEffect(() => {
    if (submission && isStudent(user)) {
      // Students cannot edit submissions, they must resubmit (create new)
      router.replace(`/assignments/${assignmentId}/submit`);
    }
  }, [submission, user, assignmentId, router]);

  useEffect(() => {
    if (submission) {
      setSubmissionData({
        content: submission.content || '',
        media_id: submission.media_id || undefined,
        external_url: submission.external_url || '',
      });
    }
  }, [submission]);

  const handleGoBack = useGoBack(`/submissions/${submissionId}`);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!submission) return;

    // Only allow update if status is 'submitted' or user is student owner
    if (submission.status === 'graded' && user?.role === 'student') {
      showError('Không thể chỉnh sửa bài nộp đã được chấm');
      return;
    }

    // Validate that at least one submission field is provided
    if (!submissionData.content && !submissionData.media_id && !submissionData.external_url) {
      showError('Vui lòng cung cấp nội dung bài nộp (text, file, hoặc link)');
      return;
    }

    const result = await updateSubmission(submissionId, {
      content: submissionData.content || undefined,
      media_id: submissionData.media_id || undefined,
      external_url: submissionData.external_url || undefined,
    });

    if (result.success) {
      success('Cập nhật bài nộp thành công!');
      setTimeout(() => {
        router.push(`/submissions/${submissionId}`);
      }, 500);
    } else {
      showError(result.message || 'Lỗi khi cập nhật bài nộp');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-10 w-24 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="flex-1">
            <div className="h-8 w-64 rounded bg-gray-200 dark:bg-gray-700 animate-pulse mb-2" />
          </div>
        </div>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
        <h3 className="font-medium mb-2">Không tìm thấy bài nộp</h3>
        <button
          onClick={handleGoBack}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Quay lại
        </button>
      </div>
    );
  }

  // Students cannot edit - show message and redirect
  if (isStudent(user)) {
    return (
      <div className="rounded-lg bg-primary-pastel/40 border border-primary/30 p-6 text-primary">
        <h3 className="font-medium mb-2">Học viên không thể chỉnh sửa bài nộp</h3>
        <p className="text-sm mb-4">
          Bạn không thể chỉnh sửa bài nộp đã gửi. Nếu muốn cập nhật, vui lòng nộp lại bài tập.
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/assignments/${assignmentId}/submit`)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
          >
            Nộp lại bài
          </button>
          <button
            onClick={handleGoBack}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  const allowedSubmissionTypes = assignment?.allowed_submission_types || submission?.assignment?.allowed_submission_types || ['text'];
  const finalAssignmentId = assignmentId || (submission?.assignment && getObjId(submission.assignment)) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleGoBack}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Quay lại
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-dark dark:text-white">
            Chỉnh sửa bài nộp
          </h1>
          {submission.assignment && (
            <p className="text-dark-4 dark:text-dark-6 mt-1">
              Bài tập: {submission.assignment.title}
            </p>
          )}
        </div>
      </div>

      {/* Assignment info */}
      {assignment && (
        <div className="rounded-lg bg-primary-pastel/40 border border-primary/30 p-4">
          <p className="text-xs text-primary">
            Định dạng được phép: {allowedSubmissionTypes.map((t: string) => {
              const labels: Record<string, string> = {
                text: 'Văn bản',
                file: 'File',
                document: 'Tài liệu',
                image: 'Hình ảnh',
                video: 'Video',
                audio: 'Ghi âm',
                link: 'Liên kết',
              };
              return labels[t] || t;
            }).join(', ')}
          </p>
        </div>
      )}

      {/* Form */}
      <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DynamicSubmissionForm
            allowedSubmissionTypes={allowedSubmissionTypes}
            assignmentId={finalAssignmentId}
            value={submissionData}
            onChange={setSubmissionData}
            disabled={submission.status === 'graded' && user?.role === 'student'}
          />

          <div className="flex items-center gap-2 pt-4">
            <button
              type="submit"
              disabled={updating || (submission.status === 'graded' && user?.role === 'student')}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updating ? 'Đang lưu...' : 'Cập nhật'}
            </button>
            <button
              type="button"
              onClick={handleGoBack}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Hủy
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
