"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useClasses } from "@/hooks/use-api";
import { useGoBack } from "@/hooks/use-go-back";
import { apiClient } from "@/lib/api-client";
import { useNotification } from "@/hooks/use-notification";
import { useAuthorization } from "@/lib/authz";
import DateInput from "@/components/FormElements/DateInput";
import SelectInput from "@/components/FormElements/SelectInput";
import Button from "@/components/Common/Button";
import ButtonLink from "@/components/Common/ButtonLink";
import PausedStudentBanner from "@/components/Students/PausedStudentBanner";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  CalendarIcon,
  UserGroupIcon,
  AcademicCapIcon
} from "@heroicons/react/24/outline";
import { getObjId } from "@/lib/id-utils";

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

interface AttendanceRecord {
  student_id: string;
  status: AttendanceStatus;
  check_in_time?: string;
  check_out_time?: string;
  note?: string;
}

export default function TakeAttendancePage() {
  const router = useRouter();
  const { can } = useAuthorization();
  const handleGoBack = useGoBack('/attendance');

  // Quyền tạo điểm danh: tính 1 lần, dùng cho cả effect redirect lẫn early-return
  // bên dưới (sau tất cả hook, để thứ tự hook ổn định giữa các render).
  const canCreateAttendance = can("create", "attendance");

  const { success, error: showError } = useNotification();
  // Không gọi API danh sách lớp khi user không có quyền tạo điểm danh
  // (đang chờ effect điều hướng về /403 — tránh fetch thừa)
  const { data: classes, loading: classesLoading } = useClasses(undefined, canCreateAttendance);

  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState<any[]>([]);
  const [pausedStudents, setPausedStudents] = useState<any[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [, setSchedulesLoading] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [attendances, setAttendances] = useState<Record<string, AttendanceRecord>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverPausedBanner, setServerPausedBanner] = useState<{ enrollment?: any; studentName?: string } | null>(null);
  const selectedClass = useMemo(() => {
    if (!selectedClassId) return null;
    return classes?.find((cls: any) => getObjId(cls) === selectedClassId) || null;
  }, [classes, selectedClassId]);

  // Load schedules when class is selected
  useEffect(() => {
    if (selectedClassId) {
      setSchedulesLoading(true);
      apiClient.getClassSchedules(selectedClassId)
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
  }, [selectedClassId]);

  // Load sessions when schedules are available
  useEffect(() => {
    if (schedules.length > 0) {
      setSessionsLoading(true);
      const sessionPromises = schedules.map((schedule: any) => {
        const scheduleId = getObjId(schedule);
        if (!scheduleId || scheduleId === "undefined") return Promise.resolve([]);

        return apiClient.getScheduleSessions(scheduleId)
          .then((response: any) => {
            if (response.success) {
              const sessionsList = response.data?.sessions || response.data?.data || [];
              // Add schedule info to each session
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

  // Load students when class is selected
  useEffect(() => {
    if (selectedClassId) {
      setStudentsLoading(true);
      apiClient.getClassStudents(selectedClassId)
        .then((response: any) => {
          if (response.success) {
            const studentsList = response.data?.students || response.data || [];
            const paused = studentsList.filter((student: any) => student?.enrollment?.is_paused);
            const activeStudents = studentsList.filter((student: any) => !student?.enrollment?.is_paused);
            setPausedStudents(paused);
            setStudents(activeStudents);
            setServerPausedBanner(null);
            // Initialize attendance records
            const initialAttendances: Record<string, AttendanceRecord> = {};
            activeStudents.forEach((student: any) => {
              const studentId = getObjId(student);
              initialAttendances[studentId] = {
                student_id: studentId,
                status: 'present',
              };
            });
            setAttendances(initialAttendances);
          }
          setStudentsLoading(false);
        })
        .catch(() => {
          setStudentsLoading(false);
        });
    } else {
      setStudents([]);
      setPausedStudents([]);
      setServerPausedBanner(null);
      setAttendances({});
    }
  }, [selectedClassId]);


  // Update date when session is selected
  useEffect(() => {
    if (selectedSessionId && sessions.length > 0) {
      const selectedSession = sessions.find((s: any) => getObjId(s) === selectedSessionId);
      if (selectedSession) {
        const sessionDate = selectedSession.session_date || selectedSession.date;
        if (sessionDate) {
          setSelectedDate(sessionDate.split('T')[0]);
        }
      }
    }
  }, [selectedSessionId, sessions]);

  // Không có quyền tạo điểm danh → điều hướng về 403. Dùng useEffect thay vì
  // redirect giữa render (tránh side-effect-during-render và giữ hook order ổn định).
  useEffect(() => {
    if (!canCreateAttendance) {
      router.replace("/403");
    }
  }, [canCreateAttendance, router]);

  // Chặn render nội dung khi không đủ quyền (đang chờ effect điều hướng)
  if (!canCreateAttendance) {
    return null;
  }

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendances(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        student_id: studentId,
        status,
      }
    }));
  };

  const handleNoteChange = (studentId: string, note: string) => {
    setAttendances(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        student_id: studentId,
        status: prev[studentId]?.status || 'present',
        note,
      }
    }));
  };

  // Format session display text
  const formatSessionDisplay = (session: any): string => {
    const date = session.session_date || session.date;
    const startTime = session.start_time || '';
    const endTime = session.end_time || '';
    const status = session.status || 'scheduled';

    const dateStr = date ? new Date(date).toLocaleDateString('vi-VN') : '';
    const timeStr = startTime && endTime ? `${startTime} - ${endTime}` : startTime || '';

    let statusText = '';
    if (status === 'completed') statusText = ' (Đã hoàn thành)';
    else if (status === 'cancelled') statusText = ' (Đã hủy)';
    else if (status === 'postponed') statusText = ' (Hoãn)';

    return `${dateStr}${timeStr ? ` - ${timeStr}` : ''}${statusText}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedClassId) {
      showError('Vui lòng chọn lớp học', '');
      return;
    }

    if (!selectedDate) {
      showError('Vui lòng chọn buổi học hoặc ngày điểm danh', '');
      return;
    }

    if (students.length === 0) {
      showError('Lớp học không có học viên', '');
      return;
    }

    setSubmitting(true);
    setServerPausedBanner(null);

    try {
      const attendanceData = {
        class_id: selectedClassId,
        date: selectedDate,
        attendances: Object.values(attendances)
          .filter(a => a && a.student_id)
          .map(a => ({
            student_id: a.student_id,
            status: a.status,
            note: a.note || undefined,
          })),
      };

      const response = await apiClient.createAttendance(attendanceData);

      if (response.success) {
        success('Điểm danh thành công', `Đã điểm danh cho ${response.data?.count || students.length} học viên`);
        router.push('/attendance');
      } else if (response.code === 'STUDENT_PAUSED') {
        setServerPausedBanner({
          enrollment: response.data?.enrollment,
          studentName: response.data?.student?.name,
        });
        showError('Học viên đang tạm dừng', response.message || 'Một số học viên đang tạm dừng nên không thể điểm danh.');
      } else {
        showError('Lỗi điểm danh', response.message || 'Không thể lưu điểm danh');
      }
    } catch (_err) {
      showError('Lỗi hệ thống', 'Đã xảy ra lỗi không mong muốn');
    } finally {
      setSubmitting(false);
    }
  };

  const presentCount = Object.values(attendances).filter(a => a?.status === 'present').length;
  const absentCount = Object.values(attendances).filter(a => a?.status === 'absent').length;
  const lateCount = Object.values(attendances).filter(a => a?.status === 'late').length;

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
          <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white truncate">Điểm danh</h1>
          <p className="text-dark-4 dark:text-dark-6 mt-1 break-words">
            Điểm danh cho lớp học
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Class and Session Selection */}
        <div className="rounded-lg bg-white p-6 dark:bg-gray-800 relative z-30 min-h-[400px]">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Chọn lớp học và buổi học
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SelectInput
              label="Lớp học"
              name="class_id"
              className="relative z-20"
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value);
                setSelectedSessionId("");
                setSelectedDate(new Date().toISOString().split('T')[0]);
              }}
              options={[
                { label: "Chọn lớp học", value: "" },
                ...(classes?.map((cls: any) => ({
                  label: cls.name,
                  value: getObjId(cls),
                })) || [])
              ]}
              required
              disabled={classesLoading}
              icon={classesLoading ? undefined : <AcademicCapIcon className="h-5 w-5 text-gray-400" />}
              showChevron
            />

            <div>
              {sessionsLoading ? (
                <div className="h-[41px] w-full animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
              ) : !selectedClassId ? (
                <SelectInput
                  label="Buổi học"
                  name="session_id"
                  value=""
                  onChange={() => { }}
                  options={[{ label: "Vui lòng chọn lớp học trước", value: "" }]}
                  disabled
                  required
                />
              ) : sessions.length === 0 ? (
                <div className="space-y-2">
                  <SelectInput
                    label="Buổi học"
                    name="session_id"
                    value=""
                    onChange={() => { }}
                    options={[{ label: "Lớp học chưa có buổi học", value: "" }]}
                    disabled
                    required
                  />
                  <DateInput
                    label="Hoặc nhập ngày thủ công:"
                    placeholder="Chọn ngày"
                    name="selected_date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    required
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <SelectInput
                    label="Buổi học"
                    name="session_id"
                    value={selectedSessionId}
                    onChange={(e) => setSelectedSessionId(e.target.value)}
                    options={[
                      { label: "Chọn buổi học", value: "" },
                      ...sessions.map((session: any) => ({
                        label: formatSessionDisplay(session),
                        value: getObjId(session),
                      }))
                    ]}
                    required
                    showChevron
                  />
                  {selectedSessionId && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <CalendarIcon className="h-4 w-4" />
                      <span>Ngày điểm danh: <strong>{new Date(selectedDate).toLocaleDateString('vi-VN')}</strong></span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {selectedClass && (
            <div className="mt-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-700">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
                <UserGroupIcon className="h-5 w-5" />
                <span>
                  <strong>{selectedClass.name}</strong> - {selectedClass.tutor?.name || 'Chưa có giáo viên'}
                </span>
              </div>
              {sessions.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <AcademicCapIcon className="h-5 w-5" />
                  <span>
                    Có <strong>{sessions.length}</strong> buổi học
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {serverPausedBanner?.enrollment && (
          <div className="space-y-3">
            <PausedStudentBanner
              enrollment={serverPausedBanner.enrollment}
              studentName={serverPausedBanner.studentName}
              className={selectedClass?.name}
              description="Hệ thống đã bỏ qua học viên này khỏi danh sách điểm danh."
            />
          </div>
        )}

        {pausedStudents.length > 0 && (
          <div className="space-y-3">
            {pausedStudents.map((student: any) => (
              <PausedStudentBanner
                key={getObjId(student)}
                enrollment={student.enrollment}
                studentName={student.name}
                className={selectedClass?.name}
                description="Học viên đang tạm dừng nên không thể điểm danh."
              />
            ))}
          </div>
        )}

        {/* Statistics */}
        {students.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="rounded-lg bg-primary-pastel/40 dark:bg-primary-pastel/20 p-3 sm:p-4 ring-1 ring-primary/10 dark:ring-primary/20">
              <div className="flex items-center gap-2">
                <div className="p-1.5 sm:p-2 rounded-full bg-primary/20 dark:bg-primary/30">
                  <CheckCircleIcon className="h-4 w-4 sm:h-5 sm:w-5 text-primary dark:text-primary-light" />
                </div>
                <span className="text-xs sm:text-sm font-medium text-primary dark:text-primary-light">Có mặt</span>
              </div>
              <p className="mt-2 text-xl sm:text-2xl font-bold text-primary dark:text-primary-light">{presentCount}</p>
            </div>

            <div className="rounded-lg bg-red-50 dark:bg-red-900/30 p-3 sm:p-4 ring-1 ring-red-200/50 dark:ring-red-800/30">
              <div className="flex items-center gap-2">
                <div className="p-1.5 sm:p-2 rounded-full bg-red-100 dark:bg-red-900/40">
                  <XCircleIcon className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 dark:text-red-400" />
                </div>
                <span className="text-xs sm:text-sm font-medium text-red-800 dark:text-red-400">Vắng mặt</span>
              </div>
              <p className="mt-2 text-xl sm:text-2xl font-bold text-red-900 dark:text-red-300">{absentCount}</p>
            </div>

            <div className="col-span-2 sm:col-span-1 rounded-lg bg-primary-pastel/40 dark:bg-primary-pastel/20 p-3 sm:p-4 ring-1 ring-primary/10 dark:ring-primary/20">
              <div className="flex items-center gap-2">
                <div className="p-1.5 sm:p-2 rounded-full bg-primary/20 dark:bg-primary/30">
                  <ClockIcon className="h-4 w-4 sm:h-5 sm:w-5 text-primary-light dark:text-primary-light" />
                </div>
                <span className="text-xs sm:text-sm font-medium text-primary-light dark:text-primary-light">Đi muộn</span>
              </div>
              <p className="mt-2 text-xl sm:text-2xl font-bold text-primary-light dark:text-primary-light">{lateCount}</p>
            </div>
          </div>
        )}

        {/* Students List */}
        {studentsLoading ? (
          <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="h-12 w-12 rounded-full bg-gray-200 dark:bg-gray-700" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-700" />
                  </div>
                  <div className="h-8 w-24 rounded bg-gray-200 dark:bg-gray-700" />
                </div>
              ))}
            </div>
          </div>
        ) : students.length > 0 ? (
          <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Danh sách học viên ({students.length})
            </h2>

            <div className="space-y-4">
              {students.map((student: any) => {
                const studentId = getObjId(student);
                const attendance = attendances[studentId];
                return (
                  <div
                    key={studentId}
                    className="grid grid-cols-1 lg:grid-cols-12 gap-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700 items-center"
                  >
                    {/* Student Info - Fixed width on large screens */}
                    <div className="lg:col-span-4 flex items-center gap-3 min-w-0">
                      <div className="h-12 w-12 flex-shrink-0 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                        <span className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                          {student.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 dark:text-white truncate">{student.name}</p>
                        {student.email && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{student.email}</p>
                        )}
                      </div>
                    </div>

                    {/* Attendance Buttons - Fixed width */}
                    <div className="lg:col-span-5 flex flex-wrap items-center gap-2 justify-start lg:justify-center">
                      <button
                        type="button"
                        onClick={() => handleStatusChange(studentId, 'present')}
                        className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${attendance?.status === 'present'
                          ? 'bg-primary-pastel text-primary'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
                          }`}
                      >
                        <CheckCircleIcon className="h-4 w-4" />
                        Có mặt
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(studentId, 'absent')}
                        className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${attendance?.status === 'absent'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
                          }`}
                      >
                        <XCircleIcon className="h-4 w-4" />
                        Vắng
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(studentId, 'late')}
                        className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${attendance?.status === 'late'
                          ? 'bg-primary-pastel/60 text-primary-light'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
                          }`}
                      >
                        <ClockIcon className="h-4 w-4" />
                        Muộn
                      </button>
                    </div>

                    {/* Note Input - Fixed width */}
                    <div className="lg:col-span-3">
                      <input
                        type="text"
                        placeholder="Ghi chú (tùy chọn)"
                        value={attendance?.note || ''}
                        onChange={(e) => handleNoteChange(studentId, e.target.value)}
                        className="w-full h-[41px] rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white placeholder:text-gray-400"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : selectedClassId ? (
          <div className="rounded-lg bg-white p-8 text-center dark:bg-gray-800">
            <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Lớp học chưa có học viên
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Vui lòng thêm học viên vào lớp học trước khi điểm danh
            </p>
          </div>
        ) : null}

        {/* Submit Button */}
        {students.length > 0 && (
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 sm:gap-4">
            <ButtonLink
              href="/attendance"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto justify-center"
            >
              Hủy
            </ButtonLink>
            <Button
              type="submit"
              disabled={submitting}
              loading={submitting}
              size="sm"
              icon={<CheckCircleIcon />}
              className="w-full sm:w-auto justify-center"
            >
              Lưu điểm danh
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}

