"use client";
import { useParams, useRouter } from "next/navigation";
import { useLessonNote, useDeleteLessonNote } from "@/hooks/use-api";
import { useGoBack } from "@/hooks/use-go-back";
import { useAuthorization, isStudent } from "@/lib/authz";
import { useAuthContext } from "@/contexts/auth-context";
import { useLockContext } from "@/contexts/lock-context";
import { useState } from "react";
import { ArrowLeftIcon, CalendarIcon, UserIcon, PencilIcon, TrashIcon, PaperClipIcon, DocumentTextIcon, LinkIcon, AcademicCapIcon, StarIcon } from "@heroicons/react/24/outline";
import ConfirmDeleteDialog from '@/components/Common/ConfirmDeleteDialog';
import ButtonLink from "@/components/Common/ButtonLink";
import Button from "@/components/Common/Button";
import RichTextDisplay from "@/components/Common/RichTextDisplay";
import { formatFileSize } from "@/lib/format-number";
import { validateExternalUrl } from "@/lib/validate-url";
import ResourceCard from "@/components/LearningResources/ResourceCard";
import { BehaviorBadge } from "@/lib/student-note-helpers";
import { getObjId, idsEqual } from "@/lib/id-utils";
import { useErrorDisplay } from "@/components/Common/ErrorDisplay";
export default function LessonNoteDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const noteId = params.id as string;
  const { can } = useAuthorization();
  const { user } = useAuthContext();
  const isStudentUser = isStudent(user);
  const { actionsLocked, planFeatureMessage } = useLockContext();
  const { data: note, loading, error, refetch, permissions } = useLessonNote(noteId);
  const handleGoBack = useGoBack('/lesson-notes');
  const { mutate: deleteNote, loading: deleting } = useDeleteLessonNote();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { renderError } = useErrorDisplay("Chi tiết ghi chú bài học");

  // Use permissions from API response
  const canView = permissions?.can_view ?? true; // Default true cho view
  const canManage = permissions?.can_manage ?? false;

  // Kiểm tra lock và plan feature trước để ưu tiên hiển thị lock content
  if (actionsLocked || planFeatureMessage) return renderError();

  if (loading && !note) {
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
            <div className="h-6 w-1/2 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="h-24 w-full rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !note) {
    return renderError(error || "Không tìm thấy ghi chú", () => refetch());
  }

  // Check view permission - chỉ block khi không có quyền xem
  if (!loading && note && permissions !== undefined && !canView) return renderError("Bạn không có quyền xem nội dung này.");

  // Explicit client-side permission check using authz
  if (!loading && !can("view", "lesson_note")) {
    return renderError("Bạn không có quyền xem danh sách ghi chú bài học.");
  }

  // Đối với học viên: Kiểm tra xem có được gán trong ghi chú này không
  if (!loading && note && isStudentUser) {
    const studentId = getObjId(user);
    const isAssigned = note.student_notes?.some((sn: any) => idsEqual(sn.student_id || getObjId(sn.student), studentId));

    // Nếu học viên không có tên trong danh sách feedback của bài học này
    if (!isAssigned) {
      return renderError("Bạn không có quyền xem ghi chú này do không có tên trong danh sách đánh giá.");
    }
  }

  return (
    <div className="space-y-6">
      <ConfirmDeleteDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          const res = await deleteNote(noteId);
          if (res.success) router.push('/lesson-notes');
        }}
        loading={deleting}
        message="Bạn có chắc chắn muốn xóa ghi chú này? Hành động không thể hoàn tác."
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <Button
          onClick={handleGoBack}
          variant="outline"
          size="sm"
          icon={<ArrowLeftIcon />}
        >
          Quay lại danh sách
        </Button>

        <div className="flex items-center gap-2">
          {!isStudentUser && (
            <>
              <ButtonLink
                href={`/lesson-notes/${noteId}/edit`}
                variant="outline"
                size="sm"
                icon={<PencilIcon />}
                disabled={!canManage}
              >
                Chỉnh sửa
              </ButtonLink>
              <Button
                onClick={() => setConfirmDelete(true)}
                variant="danger"
                size="sm"
                icon={<TrashIcon />}
                disabled={!canManage}
              >
                Xóa
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main Document Container */}
      <div className="mx-auto max-w-[1920px]">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">

          {/* Header Section */}
          <div className="border-b border-gray-100 bg-gray-50/50 p-6 sm:p-8 dark:border-gray-700 dark:bg-gray-800/50">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-4 flex-1">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="inline-flex items-center rounded-md bg-primary-50 px-2 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/10 dark:bg-primary/10 dark:text-primary-400">
                      Ghi chú bài học
                    </span>
                    {note.rating && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-700 ring-1 ring-inset ring-yellow-600/20 dark:bg-yellow-900/20 dark:text-yellow-400">
                        <StarIcon className="h-3 w-3" />
                        {note.rating_stars || note.rating}
                      </span>
                    )}
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl leading-tight">
                    {note.topic || note.title || "Ghi chú bài học không tiêu đề"}
                  </h1>
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500 dark:text-gray-400">
                  {note.class?.name && (
                    <div className="flex items-center gap-2">
                      <AcademicCapIcon className="h-4 w-4" />
                      <span className="font-medium text-gray-700 dark:text-gray-300">{note.class.name}</span>
                    </div>
                  )}
                  {note.lesson_date && (
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      <span>{new Date(note.lesson_date).toLocaleDateString('vi-VN', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}</span>
                    </div>
                  )}
                  {note.tutor?.name && (
                    <div className="flex items-center gap-2">
                      <UserIcon className="h-4 w-4" />
                      <span>GV: {note.tutor.name}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-10 space-y-8">
            {/* Content Section */}
            <section>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                <DocumentTextIcon className="h-4 w-4" />
                Nội dung bài học
              </h3>
              <div className="prose prose-slate max-w-none dark:prose-invert prose-p:leading-relaxed prose-headings:font-bold prose-a:text-primary">
                <RichTextDisplay content={note.content} />
              </div>
            </section>

            {/* Observations Section (Teacher Only) */}
            {!isStudentUser && note.observations && (
              <section className="rounded-lg border-l-4 border-amber-400 bg-amber-50 p-6 dark:bg-amber-900/10 dark:border-amber-600">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-amber-800 dark:text-amber-500">
                  <span className="h-2 w-2 rounded-full bg-amber-400"></span>
                  Nhận xét chung về lớp
                </h3>
                <div className="prose prose-amber max-w-none text-gray-700 dark:text-gray-300">
                  <RichTextDisplay content={note.observations} />
                </div>
              </section>
            )}

            {/* Resources & Attachments Grid */}
            {(note.learning_resources?.length > 0 || note.attachments?.length > 0) && (
              <section className="pt-8 border-t border-gray-100 dark:border-gray-800">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Learning Resources */}
                  {note.learning_resources?.length > 0 && (
                    <div>
                      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        <LinkIcon className="h-4 w-4" />
                        Tài liệu học tập
                      </h3>
                      <div className="space-y-3">
                        {note.learning_resources
                          .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
                          .map((resource: any, index: number) => (
                            <ResourceCard
                              key={getObjId(resource) || `resource-${index}`}
                              resource={resource}
                              index={index}
                            />
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Attachments */}
                  {note.attachments?.length > 0 && (
                    <div>
                      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        <PaperClipIcon className="h-4 w-4" />
                        Tệp đính kèm
                      </h3>
                      <div className="space-y-3">
                        {note.attachments.map((attachment: any) => {
                          const validatedUrl = validateExternalUrl(attachment.url);
                          if (!validatedUrl) return null;
                          return (
                            <a
                              key={getObjId(attachment)}
                              href={validatedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 transition-all hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
                            >
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 group-hover:bg-white group-hover:text-primary dark:bg-gray-800 dark:text-gray-400 dark:group-hover:bg-gray-700 dark:group-hover:text-primary-300 transition-colors">
                                <DocumentTextIcon className="h-6 w-6" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 dark:text-white truncate">{attachment.name}</p>
                                {attachment.size && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {formatFileSize(attachment.size)}
                                  </p>
                                )}
                              </div>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Student Notes (Teacher Only) */}
            {!isStudentUser && note.student_notes?.length > 0 && (
              <section className="pt-8 border-t border-gray-100 dark:border-gray-800">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  <UserIcon className="h-4 w-4" />
                  Ghi chú cá nhân học viên ({note.student_notes_count || note.student_notes.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {note.student_notes.map((studentNote: any, index: number) => (
                    <div key={index} className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/50">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center text-gray-400 border border-gray-100 dark:bg-gray-800 dark:border-gray-600">
                            <UserIcon className="h-4 w-4" />
                          </div>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {studentNote.student?.name || `Học viên #${studentNote.student_id}`}
                          </span>
                        </div>
                        <BehaviorBadge
                          behavior={studentNote.behavior}
                          behaviorLabel={studentNote.behavior_label}
                        />
                      </div>
                      {studentNote.note ? (
                        <div className="relative rounded-md bg-white p-3 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300 italic">
                          <div className="absolute -top-1 left-4 h-2 w-2 rotate-45 bg-white dark:bg-gray-800"></div>
                          &quot;{studentNote.note}&quot;
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic pl-11">Không có ghi chú thêm</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {(note.created_at || note.updated_at) && (
              <div className="mt-8 pt-6 border-t border-gray-100 text-xs text-gray-400 flex items-center justify-between dark:border-gray-800">
                <span>ID: {noteId}</span>
                <span>Cập nhật lần cuối: {new Date(note.updated_at || note.created_at).toLocaleString('vi-VN')}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


