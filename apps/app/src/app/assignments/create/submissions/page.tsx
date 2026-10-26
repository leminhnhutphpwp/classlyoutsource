"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCreateSubmission, useAssignment } from "@/hooks/use-api";
import DynamicSubmissionForm from "@/components/FormElements/DynamicSubmissionForm";
import InputGroup from "@/components/FormElements/InputGroup";
import { ArrowLeftIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { useAuthorization } from "@/lib/authz";
import { useToast } from "@/contexts/toast-context";

import PausedStudentBanner from "@/components/Students/PausedStudentBanner";
import { useGoBack } from "@/hooks/use-go-back";
import Button from "@/components/Common/Button";
export default function CreateSubmissionPage() {
  const router = useRouter();
  const { can } = useAuthorization();
  const { addToast } = useToast();
  const handleGoBack = useGoBack('/submissions');

  // Quyền cập nhật bài nộp: tính 1 lần, dùng cho cả effect redirect lẫn
  // early-return bên dưới (sau tất cả hook, để thứ tự hook ổn định).
  const canUpdateSubmission = can("update", "submission");

  const { mutate: createSubmission, loading: createLoading, error: createError } = useCreateSubmission();
  const [assignmentId, setAssignmentId] = useState<string>("");
  const [studentId, setStudentId] = useState<string>("");
  const [submissionData, setSubmissionData] = useState<{
    content?: string;
    media_id?: string;
    external_url?: string;
  }>({});
  const [pausedBanner, setPausedBanner] = useState<{ enrollment?: any; studentName?: string } | null>(null);

  // Fetch assignment to get allowed_submission_types
  const { data: assignment, loading: assignmentLoading } = useAssignment(
    assignmentId || "0",
    canUpdateSubmission && Boolean(assignmentId)
  );

  // Không có quyền cập nhật bài nộp → về 403. Dùng useEffect thay vì redirect
  // giữa render (tránh side-effect-during-render và giữ hook order ổn định).
  useEffect(() => {
    if (!canUpdateSubmission) {
      router.replace("/403");
    }
  }, [canUpdateSubmission, router]);

  // Chặn render nội dung khi không đủ quyền (đang chờ effect điều hướng)
  if (!canUpdateSubmission) {
    return null;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === "assignment_id") {
      setAssignmentId(value);
    } else if (name === "student_id") {
      setStudentId(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!assignmentId || !studentId) {
      addToast({ type: "error", title: "Vui lòng nhập ID bài tập và ID học viên" });
      return;
    }

    // Validate that at least one submission field is provided
    if (!submissionData.content && !submissionData.media_id && !submissionData.external_url) {
      addToast({ type: "error", title: "Vui lòng cung cấp nội dung bài nộp (text, file, hoặc link)" });
      return;
    }

    setPausedBanner(null);

    const result = await createSubmission({
      assignment_id: assignmentId,
      student_id: studentId,
      content: submissionData.content || undefined,
      media_id: submissionData.media_id || undefined,
      external_url: submissionData.external_url || undefined,
    });

    if (result.success) {
      addToast({ type: "success", title: "Nộp bài thành công" });
      setPausedBanner(null);
      router.push('/submissions');
    } else if (result.code === "STUDENT_PAUSED") {
      setPausedBanner({
        enrollment: result.data?.enrollment,
        studentName: result.data?.student?.name || undefined,
      });
      addToast({ type: "error", title: result.message || "Học viên đang tạm dừng nên không thể nộp bài." });
    } else {
      addToast({ type: "error", title: result.message || "Lỗi khi nộp bài" });
    }
  };

  const allowedSubmissionTypes = assignment?.allowed_submission_types || ['text'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          onClick={handleGoBack}
          variant="outline"
          size="sm"
          icon={<ArrowLeftIcon />}
          className="inline-flex items-center gap-2"
        >
          Quay lại
        </Button>

        <div className="flex-1">
          <h1 className="text-2xl font-bold text-dark dark:text-white">Nộp bài tập</h1>
          <p className="text-dark-4 dark:text-dark-6 mt-1">
            Nộp bài tập cho học viên
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
        <form onSubmit={handleSubmit} className="space-y-6">
          {createError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
              {createError}
            </div>
          )}

          {pausedBanner?.enrollment && (
            <PausedStudentBanner
              enrollment={pausedBanner.enrollment}
              studentName={pausedBanner.studentName || (studentId ? `Học viên #${studentId}` : undefined)}
              description="Học viên đang tạm dừng nên không thể nộp bài cho lớp tương ứng."
            />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputGroup
              type="text"
              label="ID Bài tập"
              placeholder="Nhập ID bài tập"
              name="assignment_id"
              value={assignmentId}
              handleChange={handleChange}
              required
            />

            <InputGroup
              type="text"
              label="ID Học viên"
              placeholder="Nhập ID học viên"
              name="student_id"
              value={studentId}
              handleChange={handleChange}
              required
            />
          </div>

          {/* Assignment info */}
          {assignmentLoading && assignmentId && (
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 dark:bg-gray-700 dark:border-gray-600">
              <p className="text-sm text-gray-600 dark:text-gray-400">Đang tải thông tin bài tập...</p>
            </div>
          )}

          {assignment && (
            <div className="rounded-lg bg-primary-pastel/40 border border-primary/30 p-4">
              <h3 className="text-sm font-medium text-primary mb-1">
                {assignment.title}
              </h3>
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

          {/* Dynamic Submission Form */}
          {assignmentId && (
            <DynamicSubmissionForm
              allowedSubmissionTypes={allowedSubmissionTypes}
              assignmentId={assignmentId}
              value={submissionData}
              onChange={setSubmissionData}
            />
          )}

          {!assignmentId && (
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 dark:bg-gray-700 dark:border-gray-600">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Vui lòng nhập ID bài tập để hiển thị form nộp bài
              </p>
            </div>
          )}

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={createLoading || !assignmentId || !studentId}
              className="flex items-center rounded-lg bg-primary px-6 py-3 font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createLoading ? (
                <>
                  <ArrowPathIcon className="mr-2 h-4 w-4 animate-spin" />
                  Đang nộp...
                </>
              ) : (
                <>
                  <ArrowPathIcon className="mr-2 h-4 w-4" />
                  Nộp bài
                </>
              )}
            </button>

            <Link
              href="/submissions"
              className="rounded-lg border border-gray-300 px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Hủy
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
