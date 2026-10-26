"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import InputGroup from "@/components/FormElements/InputGroup";
import DateInput from "@/components/FormElements/DateInput";
import RichTextEditor from "@/components/FormElements/RichTextEditorDynamic";
import LearningResourceSelector from "@/components/FormElements/LearningResourceSelector";
import SelectInput from "@/components/FormElements/SelectInput";
import { useCreateLessonNote, useClasses, useClassStudents } from "@/hooks/use-api";
import { useGoBack } from "@/hooks/use-go-back";
import { useAuthContext } from "@/contexts/auth-context";
import { useResourceGuard } from "@/lib/permission-guards";
import { useNotification } from "@/hooks/use-notification";
import { apiClient } from "@/lib/api-client";
import { getObjId, idsEqual } from "@/lib/id-utils";
import { ArrowLeftIcon, DocumentTextIcon, CalendarIcon, PlusIcon, XMarkIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import type { StudentNote } from "@/lib/api-config";
import Button from "@/components/Common/Button";
import ButtonLink from "@/components/Common/ButtonLink";

export default function CreateLessonNotePage() {
  const router = useRouter();
  const { user } = useAuthContext();
  const handleGoBack = useGoBack('/lesson-notes');

  // Use resource guard to protect this route
  useResourceGuard(
    user,
    'create',
    'lesson::note',
    '/403'
  );

  // All hooks must be called before any early returns
  const { mutate: createLessonNote, loading, error } = useCreateLessonNote();
  const { data: classes } = useClasses();
  const { success, error: showError } = useNotification();

  const [formData, setFormData] = useState({
    class_id: "",
    lesson_date: new Date().toISOString().split("T")[0],
    topic: "",
    content: "",
    observations: "",
  });

  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [schedules, setSchedules] = useState<any[]>([]);
  const [, setSchedulesLoading] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const [studentNotes, setStudentNotes] = useState<StudentNote[]>([]);
  const [learningResources, setLearningResources] = useState<(string | number)[]>([]);

  const { data: classStudents } = useClassStudents(formData.class_id || "");

  const sessionOptions = sessions.map((session: any) => {
    const date = session.session_date || session.date;
    const startTime = session.start_time || "";
    const endTime = session.end_time || "";
    const dateStr = date ? new Date(date).toLocaleDateString("vi-VN") : "";
    const timeStr = startTime && endTime ? `${startTime} - ${endTime}` : startTime || "";

    const sessionId = getObjId(session);
    const isCompleted = session.status === 'completed';
    return {
      value: String(sessionId),
      label: `${dateStr}${timeStr ? ` - ${timeStr}` : ""}${isCompleted ? " (Đã hoàn thành)" : ""}`,
    };
  });

  const classStudentOptions = formData.class_id
    ? (classStudents || []).map((student: any) => {
      const studentId = getObjId(student);
      const isPaused = student.enrollment?.is_paused;
      return {
        value: String(studentId),
        label: isPaused ? `${student.name} (Tạm dừng học)` : student.name,
        disabled: isPaused,
      };
    })
    : [];

  const behaviorOptions = [
    { value: "excellent", label: "Xuất sắc" },
    { value: "good", label: "Tốt" },
    { value: "average", label: "Trung bình" },
    { value: "poor", label: "Cần cải thiện" },
  ];

  // Load schedules when class is selected
  useEffect(() => {
    if (formData.class_id) {
      setSchedulesLoading(true);
      apiClient.getClassSchedules(formData.class_id)
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
    } else {
      setSchedules([]);
      setSessions([]);
      setSelectedSessionId("");
    }
  }, [formData.class_id]);

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
          // Flatten and sort by date (newest first)
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
    } else {
      setSessions([]);
      setSelectedSessionId("");
    }
  }, [schedules]);

  // Update date when session is selected
  useEffect(() => {
    if (selectedSessionId && sessions.length > 0) {
      const selectedSession = sessions.find((s: any) => {
        const sId = getObjId(s);
        return idsEqual(sId, selectedSessionId);
      });
      if (selectedSession) {
        const sessionDate = selectedSession.session_date || selectedSession.date;
        if (sessionDate) {
          setFormData(prev => ({
            ...prev,
            lesson_date: sessionDate.split('T')[0]
          }));
        }
      }
    }
  }, [selectedSessionId, sessions]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRichTextChange = (field: 'content' | 'observations') => (value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddStudentNote = () => {
    setStudentNotes(prev => [...prev, { student_id: "", behavior: 'good', note: '' }]);
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

    // Validation
    if (!formData.class_id) {
      showError("Vui lòng chọn lớp học");
      return;
    }
    if (!formData.content.trim()) {
      showError("Vui lòng nhập nội dung bài học");
      return;
    }
    if (!formData.lesson_date) {
      showError("Vui lòng chọn ngày học");
      return;
    }

    // Validate student notes - check for duplicates
    const validStudentNotes = studentNotes.filter(sn => sn.student_id && getObjId(sn.student_id) !== '0');
    const studentIds = validStudentNotes.map(sn => getObjId(sn.student_id));
    const duplicateIds = studentIds.filter((id, index) => studentIds.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      const duplicateNames = validStudentNotes
        .filter(sn => duplicateIds.includes(getObjId(sn.student_id)))
        .map(sn => {
          const student = classStudents?.find((s: any) => idsEqual(getObjId(s), sn.student_id));
          return student?.name || `ID: ${sn.student_id}`;
        });
      showError(`Mỗi học viên chỉ có thể có một ghi chú. Vui lòng kiểm tra lại: ${duplicateNames.join(', ')}`);
      return;
    }

    const submitData: any = {
      class_id: formData.class_id,
      lesson_date: formData.lesson_date,
      content: formData.content.trim(),
    };

    // Add optional fields only if they have values
    if (formData.topic.trim()) {
      submitData.topic = formData.topic.trim();
    }
    if (formData.observations.trim()) {
      submitData.observations = formData.observations.trim();
    }

    // Add student notes if any valid ones exist
    if (validStudentNotes.length > 0) {
      submitData.student_notes = validStudentNotes.map(sn => ({
        student_id: sn.student_id,
        behavior: sn.behavior,
        note: sn.note?.trim() || undefined,
      }));
    }

    // Add learning resources if any exist
    if (learningResources.length > 0) {
      submitData.learning_resources = learningResources;
    }

    const result = await createLessonNote(submitData);
    if (result.success) {
      success("Tạo ghi chú bài học thành công!");
      setTimeout(() => {
        router.push("/lesson-notes");
      }, 500);
    } else {
      showError(result.message || "Không thể tạo ghi chú bài học. Vui lòng thử lại.");
    }
  };

  return (
    <div className="space-y-6">
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
          <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white truncate">Tạo ghi chú bài học</h1>
          <p className="text-dark-4 dark:text-dark-6 mt-1 break-words">Thêm ghi chú cho buổi học</p>
        </div>
      </div>

      <div className="max-w-2xl rounded-lg bg-white p-6 dark:bg-gray-800">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
              {error}
            </div>
          )}

          <SelectInput
            label="Lớp học"
            name="class_id"
            value={formData.class_id}
            onChange={(e) => {
              handleChange(e);
              setSelectedSessionId("");
              setFormData(prev => ({
                ...prev,
                lesson_date: new Date().toISOString().split("T")[0]
              }));
            }}
            required
            placeholder="Chọn lớp học"
            options={(classes || []).map((cls: any) => {
              const clsId = getObjId(cls);
              return {
                value: clsId,
                label: cls.name,
              };
            })}
            helperText={classes?.length === 0 ? "Chưa có lớp nào." : undefined}
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
                disabled={!formData.class_id || sessions.length === 0}
                placeholder={
                  !formData.class_id
                    ? "Vui lòng chọn lớp học trước"
                    : sessions.length === 0
                      ? "Lớp học chưa có buổi học"
                      : "Chọn buổi học"
                }
                helperText={
                  !formData.class_id
                    ? "Chọn lớp để hiển thị danh sách buổi học."
                    : sessions.length === 0
                      ? "Lớp này chưa có buổi học, hãy nhập ngày thủ công."
                      : undefined
                }
                required={sessions.length > 0}
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
              />
            </div>
            {selectedSessionId && (
              <div className="mt-2 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <CalendarIcon className="h-4 w-4" />
                <span>
                  Ngày học: <strong>{new Date(formData.lesson_date).toLocaleDateString("vi-VN")}</strong>
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
          />

          <RichTextEditor
            label="Nội dung"
            value={formData.content}
            onChange={handleRichTextChange('content')}
            placeholder="Nhập nội dung bài học"
            required
          />

          <RichTextEditor
            label="Nhận xét chung về lớp"
            value={formData.observations}
            onChange={handleRichTextChange('observations')}
            placeholder="Nhập nhận xét chung về lớp (tùy chọn)"
          />

          {/* Student Notes Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-900 dark:text-white">
                Ghi chú từng học viên (tùy chọn)
              </label>
              {formData.class_id && (
                <button
                  type="button"
                  onClick={handleAddStudentNote}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
                >
                  <PlusIcon className="h-4 w-4" />
                  Thêm học viên
                </button>
              )}
            </div>

            {!formData.class_id && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Vui lòng chọn lớp học trước khi thêm ghi chú học viên
              </p>
            )}

            {studentNotes.map((studentNote, index) => (
              <div key={index} className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/50">
                <div className="mb-3 flex items-center justify-between">
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
                    value={studentNote.student_id ? studentNote.student_id.toString() : ""}
                    onChange={(e) =>
                      handleStudentNoteChange(index, 'student_id', e.target.value)
                    }
                    required
                    disabled={!formData.class_id}
                    placeholder={
                      !formData.class_id
                        ? "Chọn lớp học trước"
                        : classStudentOptions.length === 0
                          ? "Lớp chưa có học viên"
                          : "Chọn học viên"
                    }
                    options={classStudentOptions}
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
          />

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 sm:gap-4">
            <ButtonLink
              href="/lesson-notes"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto justify-center"
            >
              Hủy
            </ButtonLink>
            <Button
              type="submit"
              disabled={loading}
              loading={loading}
              size="sm"
              variant="primary"
              icon={<CheckCircleIcon />}
              className="w-full sm:w-auto justify-center"
            >
              Tạo ghi chú
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}


