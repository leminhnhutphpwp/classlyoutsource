"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useScheduleSession, useUpdateScheduleSession } from "@/hooks/use-api";
import { useStudentGuard } from "@/hooks/use-role-guard";
import { useNotification } from "@/hooks/use-notification";
import {
  ArrowLeftIcon,
  ClockIcon,
  BuildingOfficeIcon,
  MapPinIcon,
  LinkIcon,
  CheckCircleIcon,
  CalendarIcon
} from "@heroicons/react/24/outline";
import DateInput from "@/components/FormElements/DateInput";
import InputGroup from "@/components/FormElements/InputGroup";
import SelectInput from "@/components/FormElements/SelectInput";
import { TextAreaGroup } from "@/components/FormElements/InputGroup/text-area";
import Button from "@/components/Common/Button";
import ButtonLink from "@/components/Common/ButtonLink";
import ErrorDisplay from "@/components/Common/ErrorDisplay";

export default function EditScheduleSessionPage() {
  const { isBlocked } = useStudentGuard();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: session, loading, error } = useScheduleSession(id);
  const { mutate: updateSession, loading: saving } = useUpdateScheduleSession();

  const [form, setForm] = useState({
    session_date: "",
    start_time: "",
    end_time: "",
    mode: "offline" as "offline" | "online",
    // Offline config
    room: "",
    location: "",
    notes: "",
    // Online config
    online_platform: "",
    online_meeting_url: "",
    online_meeting_id: "",
    online_meeting_password: "",
    // Status
    status: "scheduled" as "scheduled" | "completed" | "cancelled",
  });

  const { success: showSuccess, error: showError } = useNotification();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (session && !loading) {
      setForm({
        session_date: session.session_date || "",
        start_time: session.start_time || "",
        end_time: session.end_time || "",
        mode: (session.mode as "offline" | "online") || "offline",
        room: session.room || "",
        location: session.location || "",
        notes: session.notes || "",
        online_platform: session.online_platform || "",
        online_meeting_url: session.online_meeting_url || "",
        online_meeting_id: session.online_meeting_id || "",
        online_meeting_password: session.online_meeting_password || "",
        status: (session.status as "scheduled" | "completed" | "cancelled") || "scheduled",
      });
    }
  }, [session, loading]);

  if (isBlocked) {
    return null; // Guard will handle redirect
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!form.session_date || !form.start_time || !form.end_time) {
      const errorMessage = "Vui lòng điền đầy đủ các trường bắt buộc.";
      setErrorMsg(errorMessage);
      showError(errorMessage);
      return;
    }

    const payload: {
      session_date: string;
      start_time: string;
      end_time: string;
      mode: "offline" | "online";
      status: "scheduled" | "completed" | "cancelled";
      notes: string;
      room?: string;
      location?: string;
      online_platform?: string;
      online_meeting_url?: string;
      online_meeting_id?: string;
      online_meeting_password?: string;
    } = {
      session_date: form.session_date,
      start_time: form.start_time,
      end_time: form.end_time,
      mode: form.mode,
      status: form.status,
      notes: form.notes,
    };

    // Conditional fields based on mode
    if (form.mode === 'offline') {
      payload.room = form.room;
      payload.location = form.location;
    } else {
      payload.online_platform = form.online_platform;
      payload.online_meeting_url = form.online_meeting_url;
      payload.online_meeting_id = form.online_meeting_id;
      payload.online_meeting_password = form.online_meeting_password;
    }

    const result = await updateSession(id, payload);
    if (result.success) {
      showSuccess("Cập nhật buổi học thành công");
      setTimeout(() => {
        router.push(`/schedule-sessions/${id}`);
      }, 1500);
    } else {
      const errorMessage = result.message || "Không thể cập nhật buổi học";
      setErrorMsg(errorMessage);
      showError(errorMessage);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-8 w-8 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="h-8 w-64 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
        </div>
        <div className="rounded-lg bg-white p-6 dark:bg-gray-800 animate-pulse">
          <div className="h-40 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    );
  }

  if (error && !loading) {
    return <ErrorDisplay error={error} title="Lỗi tải dữ liệu buổi học" onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
        <div className="flex items-center gap-3 min-w-0">
          <ButtonLink
            href={`/schedule-sessions/${id}`}
            variant="outline"
            size="sm"
            icon={<ArrowLeftIcon />}
            className="flex-shrink-0"
          >
            Quay lại
          </ButtonLink>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white truncate">Chỉnh sửa buổi học</h1>
            <p className="text-sm text-dark-4 dark:text-dark-6 mt-0.5 truncate">Cập nhật thông tin buổi học</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
        {errorMsg && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">{errorMsg}</div>}

        {/* Card: Thông tin chung */}
        <div className="rounded-lg bg-white p-3 sm:p-4 md:p-6 dark:bg-gray-800 mb-4 sm:mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <DateInput
              label="Ngày học"
              name="session_date"
              value={form.session_date}
              handleChange={(e) => setForm(prev => ({ ...prev, session_date: e.target.value }))}
              placeholder="Chọn ngày học"
              icon={<CalendarIcon className="h-5 w-5 text-gray-400" />}
              required
            />
            <SelectInput
              label="Trạng thái"
              name="status"
              value={form.status}
              onChange={(e) => setForm(prev => ({ ...prev, status: e.target.value as "scheduled" | "completed" | "cancelled" }))}
              options={[
                { value: "scheduled", label: "Đã lên lịch" },
                { value: "completed", label: "Đã hoàn thành" },
                { value: "cancelled", label: "Đã hủy" },
              ]}
            />
            <InputGroup
              type="time"
              label="Thời gian bắt đầu"
              name="start_time"
              value={form.start_time}
              handleChange={(e) => setForm(prev => ({ ...prev, start_time: e.target.value }))}
              icon={<ClockIcon className="h-5 w-5 text-gray-400" />}
              iconPosition="left"
              required
            />
            <InputGroup
              type="time"
              label="Thời gian kết thúc"
              name="end_time"
              value={form.end_time}
              handleChange={(e) => setForm(prev => ({ ...prev, end_time: e.target.value }))}
              icon={<ClockIcon className="h-5 w-5 text-gray-400" />}
              iconPosition="left"
              required
            />
          </div>
        </div>

        {/* Card: Chế độ học */}
        <div className="rounded-lg bg-white p-3 sm:p-4 md:p-6 dark:bg-gray-800 mb-4 sm:mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 sm:mb-3">Chế độ học</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            <label className={`inline-flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg border w-full cursor-pointer transition-colors ${form.mode === 'offline' ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-gray-700'}`}>
              <input
                type="radio"
                name="mode"
                checked={form.mode === 'offline'}
                onChange={() => setForm(prev => ({ ...prev, mode: 'offline' }))}
                className="w-4 h-4 text-primary focus:ring-primary flex-shrink-0"
              />
              <span className="text-sm text-gray-800 dark:text-gray-200">Offline (Trực tiếp tại lớp)</span>
            </label>
            <label className={`inline-flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg border w-full cursor-pointer transition-colors ${form.mode === 'online' ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-gray-700'}`}>
              <input
                type="radio"
                name="mode"
                checked={form.mode === 'online'}
                onChange={() => setForm(prev => ({ ...prev, mode: 'online' }))}
                className="w-4 h-4 text-primary focus:ring-primary flex-shrink-0"
              />
              <span className="text-sm text-gray-800 dark:text-gray-200">Online (Học qua Internet)</span>
            </label>
          </div>
        </div>

        {/* Card: Cấu hình Offline */}
        {(form.mode === 'offline') && (
          <div className="rounded-lg bg-white p-3 sm:p-4 md:p-6 dark:bg-gray-800 mb-4 sm:mb-6">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 sm:mb-4">Cấu hình Offline</h3>
            <div className="grid grid-cols-1 gap-3 sm:gap-4">
              <InputGroup
                type="text"
                label="Phòng học"
                name="room"
                value={form.room}
                handleChange={(e) => setForm(prev => ({ ...prev, room: e.target.value }))}
                placeholder="Phòng học"
                icon={<BuildingOfficeIcon className="h-5 w-5 text-gray-400" />}
                iconPosition="left"
              />
              <InputGroup
                type="text"
                label="Địa điểm"
                name="location"
                value={form.location}
                handleChange={(e) => setForm(prev => ({ ...prev, location: e.target.value }))}
                placeholder="Địa điểm cụ thể"
                icon={<MapPinIcon className="h-5 w-5 text-gray-400" />}
                iconPosition="left"
              />
              <TextAreaGroup
                label="Ghi chú"
                name="notes"
                value={form.notes}
                onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                placeholder="Ghi chú"
              />
            </div>
          </div>
        )}

        {/* Card: Cấu hình Online */}
        {(form.mode === 'online') && (
          <div className="rounded-lg bg-white p-3 sm:p-4 md:p-6 dark:bg-gray-800 mb-4 sm:mb-6">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 sm:mb-4">Cấu hình Online</h3>
            <div className="grid grid-cols-1 gap-3 sm:gap-4">
              <SelectInput
                label="Nền tảng"
                name="online_platform"
                value={form.online_platform}
                onChange={(e) => setForm(prev => ({ ...prev, online_platform: e.target.value }))}
                options={[
                  { value: "", label: "Chọn nền tảng" },
                  { value: "zoom", label: "Zoom" },
                  { value: "google_meet", label: "Google Meet" },
                  { value: "microsoft_teams", label: "Microsoft Teams" },
                  { value: "other", label: "Khác" },
                ]}
              />
              <InputGroup
                type="url"
                label="Link meeting"
                name="online_meeting_url"
                value={form.online_meeting_url}
                handleChange={(e) => setForm(prev => ({ ...prev, online_meeting_url: e.target.value }))}
                placeholder="https://..."
                icon={<LinkIcon className="h-5 w-5 text-gray-400" />}
                iconPosition="left"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <InputGroup
                  type="text"
                  label="Meeting ID"
                  name="online_meeting_id"
                  value={form.online_meeting_id}
                  handleChange={(e) => setForm(prev => ({ ...prev, online_meeting_id: e.target.value }))}
                  placeholder="Meeting ID"
                />
                <InputGroup
                  type="text"
                  label="Password"
                  name="online_meeting_password"
                  value={form.online_meeting_password}
                  handleChange={(e) => setForm(prev => ({ ...prev, online_meeting_password: e.target.value }))}
                  placeholder="Password"
                />
              </div>
              <TextAreaGroup
                label="Ghi chú"
                name="notes"
                value={form.notes}
                onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                placeholder="Ghi chú"
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-3">
          <ButtonLink
            href={`/schedule-sessions/${id}`}
            variant="outline"
            size="sm"
            className="w-full sm:w-auto justify-center"
          >
            Hủy
          </ButtonLink>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={saving}
            icon={<CheckCircleIcon />}
            className="w-full sm:w-auto justify-center"
          >
            Cập nhật
          </Button>
        </div>
      </form>
    </div>
  );
}

