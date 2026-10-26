"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import InputGroup from "@/components/FormElements/InputGroup";
import DateInput from "@/components/FormElements/DateInput";
import RichTextEditor from "@/components/FormElements/RichTextEditorDynamic";
import LearningResourceSelector from "@/components/FormElements/LearningResourceSelector";
import SelectInput from "@/components/FormElements/SelectInput";
import { useLessonNote, useUpdateLessonNote, useClassStudents } from "@/hooks/use-api";
import { useGoBack } from "@/hooks/use-go-back";
import { useAuthContext } from "@/contexts/auth-context";
import { useResourceGuard } from "@/lib/permission-guards";
import { ArrowLeftIcon, DocumentTextIcon, CalendarIcon, PlusIcon, XMarkIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { useNotification } from "@/hooks/use-notification";
import { apiClient } from "@/lib/api-client";
import { getObjId, idsEqual } from "@/lib/id-utils";
import type { StudentNote } from "@/lib/api-config";
import Button from "@/components/Common/Button";
import ButtonLink from "@/components/Common/ButtonLink";

export default function EditLessonNotePage() {
  const params = useParams();
  const router = useRouter();
  const noteId = params.id as string;
  const { user } = useAuthContext();
  const handleGoBack = useGoBack(`/lesson-notes/${noteId}`);

  // All hooks must be called before any early returns
  const { data: note, loading: noteLoading, error: noteError, permissions } = useLessonNote(noteId);
  const { mutate: updateLessonNote, loading: updateLoading, error: updateError } = useUpdateLessonNote();
  const { success } = useNotification();

  // Use resource guard to protect this route (check after note loads)
  const { hasAccess, isChecking } = useResourceGuard(
    user,
    'update',
    'lesson::note',
    '/lesson-notes',
    {
      checkAfterLoad: true,
      loaded: !noteLoading && !!note,
    }
  );

  // Check permissions from API response
  const canManageFromApi = permissions?.can_manage ?? false;

  // All hooks must be called before any early returns
  const [formData, setFormData] = useState({
    lesson_date: "",
    topic: "",
    content: "",
    observations: "",
  });

  const [studentNotes, setStudentNotes] = useState<StudentNote[]>([]);
  const [learningResources, setLearningResources] = useState<(string | number)[]>([]);

  const { data: classStudents } = useClassStudents(getObjId(note?.class_id));

  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [schedules, setSchedules] = useState<any[]>([]);
  const [, setSchedulesLoading] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  useEffect(() => {
    if (note) {
      setFormData({
        lesson_date: (note.date || note.lesson_date) ? new Date(note.date || note.lesson_date).toISOString().split("T")[0] : "",
        topic: note.topic || "",
        content: note.content || "",
        observations: note.observations || "",
      });
      setStudentNotes((note.student_notes || []).map((sn: any) => ({
        student_id: sn.student_id || getObjId(sn.student) || 0,
        behavior: sn.behavior || 'good',
        note: sn.note || '',
      })));
      setLearningResources(note.learning_resources?.map((lr: any) => getObjId(lr)) || []);
    }
  }, [note]);

  // Load schedules and sessions when note is available
  useEffect(() => {
    if (note?.class_id) {
      const classId = getObjId(note.class_id);
      setSchedulesLoading(true);

      apiClient.getClassSchedules(classId)
        .then((response: any) => {
          if (response.success) {
            const schedulesList = response.data?.schedules || response.data || [];
            setSchedules(schedulesList);
          }
          setSchedulesLoading(false);
        })
        .catch(() => {
          setSchedulesLoading(false);
        });
    }
  }, [note?.class_id]);

  // Load sessions when schedules are available
  useEffect(() => {
    if (schedules.length > 0) {
      setSessionsLoading(true);
      const sessionPromises = schedules.map((schedule: any) => {
        const scheduleId = getObjId(schedule);
        if (!scheduleId) return Promise.resolve([]);

        return apiClient.getScheduleSessions(String(scheduleId))
          .then((response: any) => {
            if (response.success) {
              const sessionsList = response.data?.sessions || response.data?.data || [];
              return sessionsList.map((session: any) => ({
                ...session,
                schedule_id: scheduleId,
                schedule_name: schedule.name,
              }));
            }
            return [];
          })
          .catch(() => []);
      });

      Promise.all(sessionPromises)
        .then((allSessions) => {
          const flattenedSessions = allSessions.flat();
          flattenedSessions.sort((a: any, b: any) => {
            const dateA = new Date(a.session_date || a.date || 0);
            const dateB = new Date(b.session_date || b.date || 0);
            return dateB.getTime() - dateA.getTime();
          });
          setSessions(flattenedSessions);
          setSessionsLoading(false);
        })
        .catch(() => {
          setSessionsLoading(false);
        });
    }
  }, [schedules]);

  // Try to match existing date to a session
  useEffect(() => {
    if (formData.lesson_date && sessions.length > 0 && !selectedSessionId) {
      const matchingSession = sessions.find((s: any) => {
        const sDate = s.session_date || s.date;
        return sDate && sDate.split("T")[0] === formData.lesson_date;
      });

      if (matchingSession) {
        setSelectedSessionId(getObjId(matchingSession));
      }
    }
  }, [formData.lesson_date, sessions, selectedSessionId]); // Run when date or sessions load

  // Update date when session is selected via UI
  useEffect(() => {
    if (selectedSessionId && sessions.length > 0) {
      const selectedSession = sessions.find((s: any) => {
        return idsEqual(s, selectedSessionId);
      });
      if (selectedSession) {
        const sessionDate = selectedSession.session_date || selectedSession.date;
        if (sessionDate) {
          const newDate = sessionDate.split('T')[0];
          // Only update if different to avoid infinite loops if we had bi-directional sync (which we don't fully, but safe to check)
          if (newDate !== formData.lesson_date) {
            setFormData(prev => ({
              ...prev,
              lesson_date: newDate
            }));
          }
        }
      }
    }
  }, [selectedSessionId, sessions, formData.lesson_date]);

  const sessionOptions = sessions.map((session: any) => {
    const date = session.session_date || session.date;
    const startTime = session.start_time || "";
    const endTime = session.end_time || "";
    const dateStr = date ? new Date(date).toLocaleDateString("vi-VN") : "";
    const timeStr = startTime && endTime ? `${startTime} - ${endTime}` : startTime || "";

    return {
      value: getObjId(session),
      label: `${dateStr}${timeStr ? ` - ${timeStr}` : ""}`,
    };
  });

  // Consolidate loading state - check loading FIRST before permission checks
  const isLoading = noteLoading || isChecking;

  // Show loading skeleton FIRST - before any permission checks
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-10 w-24 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="flex-1">
            <div className="h-8 w-64 rounded bg-gray-200 dark:bg-gray-700 animate-pulse mb-2" />
          </div>
        </div>
        <div className="max-w-2xl rounded-lg bg-white p-6 dark:bg-gray-800">
          <div className="space-y-6">
            {/* Class name skeleton */}
            <div className="space-y-2">
              <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-12 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            {/* Session skeleton */}
            <div className="space-y-2">
              <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-12 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            {/* Date skeleton */}
            <div className="space-y-2">
              <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-12 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            {/* Topic skeleton */}
            <div className="space-y-2">
              <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-12 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            {/* Content editor skeleton */}
            <div className="space-y-2">
              <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-48 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            {/* Observations editor skeleton */}
            <div className="space-y-2">
              <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-32 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            {/* Learning resources skeleton */}
            <div className="space-y-2">
              <div className="h-4 w-28 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-20 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            {/* Buttons skeleton */}
            <div className="flex gap-3 justify-end">
              <div className="h-10 w-20 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-10 w-24 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Check error AFTER loading is done
  if (noteError || (!noteLoading && !note)) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
        <h3 className="font-medium mb-2">Lỗi tải dữ liệu</h3>
        <p>{noteError || "Không tìm thấy ghi chú"}</p>
      </div>
    );
  }

  // Show nothing while checking permissions or redirecting (only after loading is done)
  if (!isLoading && (!hasAccess || (note && permissions !== undefined && !canManageFromApi))) {
    return null;
  }

  const classStudentOptions = (classStudents || []).map((student: any) => {
    const isPaused = student.enrollment?.is_paused;
    return {
      value: getObjId(student),
      label: isPaused ? `${student.name} (Tạm dừng học)` : student.name,
      disabled: isPaused,
    };
  });

  // Get available student options for a specific note index (exclude already selected students)
  const getAvailableStudentOptions = (currentIndex: number) => {
    const selectedStudentIds = (studentNotes || [])
      .map((sn, idx) => idx !== currentIndex ? getObjId(sn.student_id) : null)
      .filter(id => id && id !== '0');

    return [
      { value: '', label: '-- Chọn học viên --' },
      ...classStudentOptions.filter((option: any) =>
        !selectedStudentIds.includes(getObjId(option.value))
      )
    ];
  };

  const behaviorOptions = [
    { value: "excellent", label: "Xuất sắc" },
    { value: "good", label: "Tốt" },
    { value: "average", label: "Trung bình" },
    { value: "poor", label: "Cần cải thiện" },
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRichTextChange = (field: 'content' | 'observations') => (value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddStudentNote = () => {
    setStudentNotes(prev => [...prev, { student_id: '', behavior: 'good', note: '' }]);
  };

  const handleRemoveStudentNote = (index: number) => {
    setStudentNotes(prev => prev.filter((_, i) => i !== index));
  };

  const handleStudentNoteChange = (index: number, field: keyof StudentNote, value: any) => {
    setStudentNotes(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.content.trim()) return;

    const submitData: any = {
      lesson_date: formData.lesson_date || undefined,
      content: formData.content,
    };

    if (formData.topic.trim()) submitData.topic = formData.topic;
    if (formData.observations.trim()) submitData.observations = formData.observations;
    if (studentNotes.length > 0) {
      submitData.student_notes = studentNotes
        .filter(sn => sn.student_id && getObjId(sn.student_id) !== '0')
        .map(sn => ({
          student_id: sn.student_id,
          behavior: sn.behavior,
          note: sn.note?.trim() || undefined,
        }));
    }
    if (learningResources.length > 0) {
      submitData.learning_resources = learningResources;
    }

    const result = await updateLessonNote(noteId, submitData);
    if (result.success) {
      success("Cập nhật ghi chú thành công");
      setTimeout(() => {
        router.push(`/lesson-notes/${noteId}`);
      }, 500);
    }
  };

  /* Loading moved up */



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
          <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white truncate">
            Chỉnh sửa ghi chú
          </h1>
        </div>
      </div>

      <div className="max-w-2xl rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
        <form onSubmit={handleSubmit} className="space-y-6">
          {updateError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
              {updateError}
            </div>
          )}

          <InputGroup
            label="Lớp học"
            name="class_name"
            value={note?.class?.name || "Đang tải..."}
            type="text"
            disabled
            placeholder="Lớp học"
          />

          {/* Session Selection */}
          <div>
            {sessionsLoading ? (
              <div className="h-10 w-full animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
            ) : (
              <SelectInput
                label="Buổi học"
                name="session_id"
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                options={sessionOptions}
                disabled={sessions.length === 0}
                placeholder={
                  sessions.length === 0
                    ? "Lớp học chưa có lịch buổi học"
                    : "Chọn buổi học từ lịch (sẽ tự động điền ngày)"
                }
                helperText={
                  sessions.length === 0
                    ? undefined
                    : "Chọn buổi học để tự động điền ngày học."
                }
              />
            )}
            <div className="mt-2">
              <DateInput
                label={sessions.length > 0 ? "Hoặc nhập ngày thủ công:" : "Ngày học"}
                placeholder="Chọn ngày"
                name="lesson_date"
                value={formData.lesson_date}
                onChange={handleChange}
                icon={<CalendarIcon />}
                required
                disabled={updateLoading}
              />
            </div>
            {selectedSessionId && (
              <div className="mt-2 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <CalendarIcon className="h-4 w-4" />
                <span>
                  Ngày được chọn từ lịch học: <strong>{new Date(formData.lesson_date).toLocaleDateString("vi-VN")}</strong>
                </span>
              </div>
            )}
          </div>

          <InputGroup
            type="text"
            label="Chủ đề bài học"
            placeholder="Nhập chủ đề bài học (tùy chọn)"
            name="topic"
            value={formData.topic}
            handleChange={handleChange}
            icon={<DocumentTextIcon />}
            disabled={updateLoading}
          />

          <RichTextEditor
            label="Nội dung"
            value={formData.content}
            onChange={handleRichTextChange('content')}
            placeholder="Nhập nội dung bài học"
            required
            disabled={updateLoading}
          />

          <RichTextEditor
            label="Nhận xét chung về lớp"
            value={formData.observations}
            onChange={handleRichTextChange('observations')}
            placeholder="Nhập nhận xét chung về lớp (tùy chọn)"
            disabled={updateLoading}
          />

          {/* Student Notes Section */}
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <label className="block text-sm font-medium text-gray-900 dark:text-white">
                Ghi chú từng học viên (tùy chọn)
              </label>
              <button
                type="button"
                onClick={handleAddStudentNote}
                className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
              >
                <PlusIcon className="h-4 w-4" />
                Thêm học viên
              </button>
            </div>

            {studentNotes.map((studentNote, index) => (
              <div
                key={index}
                className={`rounded-lg border border-gray-200 bg-gray-50 p-4 sm:p-5 dark:border-gray-700 dark:bg-gray-900/50 ${updateLoading ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                    Học viên #{index + 1}
                  </h4>
                  <button
                    type="button"
                    onClick={() => handleRemoveStudentNote(index)}
                    className="text-red-600 hover:text-red-700 dark:text-red-400"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-3">
                  <SelectInput
                    label="Học viên"
                    name={`student_notes_${index}_student`}
                    value={studentNote.student_id && getObjId(studentNote.student_id) !== '0' ? getObjId(studentNote.student_id) : ""}
                    onChange={(e) =>
                      handleStudentNoteChange(index, 'student_id', e.target.value)
                    }
                    required
                    placeholder="Chọn học viên"
                    options={getAvailableStudentOptions(index)}
                  />

                  <SelectInput
                    label="Hành vi"
                    name={`student_notes_${index}_behavior`}
                    value={studentNote.behavior}
                    onChange={(e) => handleStudentNoteChange(index, 'behavior', e.target.value)}
                    required
                    options={behaviorOptions}
                  />

                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                      Ghi chú (tùy chọn)
                    </label>
                    <textarea
                      value={studentNote.note || ''}
                      onChange={(e) => handleStudentNoteChange(index, 'note', e.target.value)}
                      rows={2}
                      placeholder="Nhập ghi chú..."
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Learning Resources Section */}
          <LearningResourceSelector
            label="Tài liệu đính kèm"
            value={learningResources}
            onChange={setLearningResources}
            disabled={updateLoading}
            initialResources={note?.learning_resources}
          />

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
            <ButtonLink
              href={`/lesson-notes/${noteId}`}
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
              Cập nhật
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}


