"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useClasses, useSchedule, useUpdateSchedule } from "@/hooks/use-api";
import { useGoBack } from "@/hooks/use-go-back";
import { useAuthContext } from "@/contexts/auth-context";
import { useResourceGuard } from "@/lib/permission-guards";
import { useNotification } from "@/hooks/use-notification";
import DateInput from "@/components/FormElements/DateInput";
import SelectInput from "@/components/FormElements/SelectInput";
import InputGroup from "@/components/FormElements/InputGroup";
import { ArrowLeftIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import Button from "@/components/Common/Button";
import ButtonLink from "@/components/Common/ButtonLink";
import AlternatingWeeksPattern from "@/components/Schedules/AlternatingWeeksPattern";
import { getObjId } from "@/lib/id-utils";
import ErrorDisplay from "@/components/Common/ErrorDisplay";

export default function EditSchedulePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { user } = useAuthContext();
  const handleGoBack = useGoBack(`/schedules/${id}`);

  // All hooks must be called before any early returns
  const { data: schedule, loading, error, permissions } = useSchedule(id);
  const { data: classes, loading: classesLoading } = useClasses();
  const { mutate: updateSchedule, loading: saving } = useUpdateSchedule();
  const { success, error: showError } = useNotification();

  // Use resource guard to protect this route (check after schedule loads)
  const { hasAccess, isChecking } = useResourceGuard(
    user,
    'update',
    'schedule',
    `/schedules/${id}`,
    {
      checkAfterLoad: true,
      loaded: !loading && !!schedule,
    }
  );

  // Check permissions from API response
  const canManageFromApi = permissions?.can_manage ?? false;

  // All hooks must be called before any early returns
  const classOptions = useMemo(() => classes || [], [classes]);
  const classSelectOptions = useMemo(
    () =>
      classOptions.map((c: any) => ({
        value: getObjId(c),
        label: c.name,
      })),
    [classOptions]
  );

  // Constants (not hooks, but need to be accessible) - use useMemo to ensure consistent order
  const frequencyOptions = useMemo(() => [
    { value: "daily", label: "Hàng ngày" },
    { value: "weekly", label: "Hàng tuần" },
    { value: "monthly", label: "Hàng tháng" },
  ], []);

  const onlinePlatformOptions = useMemo(() => [
    { value: "", label: "Chọn nền tảng" },
    { value: "zoom", label: "Zoom" },
    { value: "google_meet", label: "Google Meet" },
    { value: "microsoft_teams", label: "Microsoft Teams" },
    { value: "other", label: "Khác" },
  ], []);

  const weekdayOptions = useMemo(() => [
    { value: 1, label: "Thứ 2" },
    { value: 2, label: "Thứ 3" },
    { value: 3, label: "Thứ 4" },
    { value: 4, label: "Thứ 5" },
    { value: 5, label: "Thứ 6" },
    { value: 6, label: "Thứ 7" },
    { value: 0, label: "Chủ nhật" },
  ], []);

  const [form, setForm] = useState({
    class_id: "",
    start_date: "",
    end_date: "",
    frequency: "weekly" as "daily" | "weekly" | "monthly",
    days_of_week: [] as number[],
    // single time range via start_time & end_time
    default_mode: "offline" as "offline" | "online",
    // Status
    is_active: true,
    // Offline config
    offline_room: "",
    offline_location: "",
    offline_note: "",
    // Online config
    online_platform: "",
    online_link: "",
    online_meeting_id: "",
    online_password: "",
    // Alternate by week
    alternate_by_week: false,
    alternate_weeks: [] as Array<{ mode: "offline" | "online" }>,
  });

  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && schedule) {
      setForm({
        class_id: String(schedule.class_id || (schedule.class && getObjId(schedule.class)) || ""),


        start_date: schedule.start_date || "",
        end_date: schedule.end_date || "",
        frequency: (schedule.recurring_type as any) || "weekly",
        // prefer backend recurring_days (0-6) if provided
        days_of_week: (schedule.recurring_days as number[] | undefined) || schedule.days_of_week || [],
        // initialize start/end from backend
        default_mode: (schedule.default_mode as any) || "offline",
        offline_room: schedule.offline?.room || schedule.room || "",
        offline_location: schedule.offline?.location || schedule.location || "",
        offline_note: schedule.offline?.note || (schedule as any).notes || "",
        online_platform: schedule.online?.platform || (schedule as any).online_platform || "",
        online_link: schedule.online?.link || (schedule as any).online_meeting_url || (schedule as any).online_link || "",
        online_meeting_id: schedule.online?.meeting_id || (schedule as any).online_meeting_id || "",
        online_password: schedule.online?.password || (schedule as any).online_password || (schedule as any).online_meeting_password || "",
        // map backend fields for alternating mode
        alternate_by_week: Boolean((schedule as any).is_alternating ?? (schedule as any).alternate_by_week),
        alternate_weeks: (schedule as any).alternating_pattern || (schedule as any).alternate_weeks || [],
        // status
        is_active: Boolean((schedule as any).is_active ?? true),
      });
      // set start/end time from fields or parse time_range
      setStartTime(schedule.start_time || (schedule.time_range ? (String(schedule.time_range).split("-")[0] || "").trim() : ""));
      setEndTime(schedule.end_time || (schedule.time_range ? (String(schedule.time_range).split("-")[1] || "").trim() : ""));
    }
  }, [loading, schedule]);

  // Recalculate alternate weeks based on date range when enabled
  useEffect(() => {
    if (!form.alternate_by_week) return;
    if (!form.start_date || !form.end_date) return;
    const start = new Date(form.start_date);
    const end = new Date(form.end_date);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return;
    const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const weeks = Math.max(1, Math.floor(diffDays / 7));
    setForm(prev => {
      if (prev.alternate_weeks.length === weeks) return prev;
      const preserved = prev.alternate_weeks.slice(0, weeks);
      const fill: Array<{ mode: "offline" | "online" }> = [];
      for (let i = preserved.length; i < weeks; i++) {
        const nextMode = (i % 2 === 0)
          ? prev.default_mode
          : (prev.default_mode === 'offline' ? 'online' : 'offline');
        fill.push({ mode: nextMode });
      }
      return { ...prev, alternate_weeks: [...preserved, ...fill] };
    });
  }, [form.alternate_by_week, form.start_date, form.end_date, form.default_mode]);

  // Consolidate loading state - check loading FIRST before permission checks
  const isLoading = loading || classesLoading || isChecking;

  // Show loading skeleton FIRST - before any permission checks
  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center gap-4">
          <div className="h-8 w-8 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="flex-1">
            <div className="h-8 w-48 rounded bg-gray-200 dark:bg-gray-700 animate-pulse mb-2" />
            <div className="h-4 w-64 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
          </div>
        </div>

        {/* Form Skeleton */}
        <div className="max-w-2xl rounded-lg bg-white p-6 dark:bg-gray-800 space-y-6">
          {/* Card: Thông tin chung */}
          <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-10 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-6 w-32 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-10 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-28 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-10 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
            </div>
          </div>

          {/* Card: Tần suất & Thứ trong tuần */}
          <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-10 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="flex flex-wrap gap-2">
                  {[...Array(7)].map((_, i) => (
                    <div key={i} className="h-8 w-16 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Card: Khung giờ */}
          <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800 space-y-2">
            <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="flex gap-2 items-center">
              <div className="h-10 flex-1 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-4 w-4 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-10 flex-1 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
          </div>

          {/* Card: Template */}
          <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800 space-y-4">
            <div className="pb-4 border-b border-gray-200 dark:border-gray-700">
              <div className="h-5 w-48 rounded bg-gray-200 dark:bg-gray-700 animate-pulse mb-2" />
              <div className="h-3 w-64 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="h-4 w-40 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-16 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
                  <div className="h-16 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                <div className="h-5 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="space-y-3">
                  <div className="h-10 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
                  <div className="h-10 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
                  <div className="h-20 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4">
            <div className="h-10 w-20 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="h-10 w-24 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // Check error AFTER loading is done
  if (error || (!loading && !schedule)) {
    return <ErrorDisplay error={error || "Không tìm thấy lịch học"} title="Chỉnh sửa lịch học" onRetry={() => window.location.reload()} />;
  }

  // Show nothing while checking permissions or redirecting (only after loading is done)
  if (!isLoading && (!hasAccess || (schedule && permissions !== undefined && !canManageFromApi))) {
    return null;
  }

  const addWeek = () => setForm(prev => {
    let maxWeeks = Infinity;
    if (prev.start_date && prev.end_date) {
      const start = new Date(prev.start_date);
      const end = new Date(prev.end_date);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
        const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        maxWeeks = Math.max(1, Math.floor(diffDays / 7));
      }
    }
    if (prev.alternate_weeks.length >= maxWeeks) return prev;
    return { ...prev, alternate_weeks: [...prev.alternate_weeks, { mode: "offline" }] };
  });
  const removeWeek = (index: number) => setForm(prev => ({ ...prev, alternate_weeks: prev.alternate_weeks.filter((_, i) => i !== index) }));
  const updateWeek = (index: number, patch: Partial<{ mode: "offline" | "online" }>) => setForm(prev => ({ ...prev, alternate_weeks: prev.alternate_weeks.map((w, i) => i === index ? { ...w, ...patch } : w) }));

  const toggleDay = (day: number) => {
    setForm(prev => (
      prev.days_of_week.includes(day)
        ? { ...prev, days_of_week: prev.days_of_week.filter(d => d !== day) }
        : { ...prev, days_of_week: [...prev.days_of_week, day] }
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!form.class_id || !form.start_date) {
      setErrorMsg("Vui lòng chọn Lớp và Ngày bắt đầu");
      return;
    }

    const payload: any = {
      class_id: getObjId(form.class_id),
      start_date: form.start_date,
      end_date: form.end_date || undefined,
      recurring_type: form.frequency,
      recurring_days: form.frequency === 'weekly' && form.days_of_week.length ? form.days_of_week : undefined,
      start_time: startTime || undefined,
      end_time: endTime || undefined,
      default_mode: form.default_mode,
      // offline (top-level)
      room: form.offline_room || undefined,
      location: form.offline_location || undefined,
      notes: form.offline_note || undefined,
      // online (top-level)
      online_platform: form.online_platform || undefined,
      online_meeting_url: form.online_link || undefined,
      online_meeting_id: form.online_meeting_id || undefined,
      online_meeting_password: form.online_password || undefined,
      // status
      is_active: form.is_active,
    };

    if (form.alternate_by_week) {
      payload.is_alternating = true;
      let maxWeeks = form.alternate_weeks.length;
      if (form.start_date && form.end_date) {
        const start = new Date(form.start_date);
        const end = new Date(form.end_date);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
          const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          maxWeeks = Math.max(1, Math.floor(diffDays / 7));
        }
      }
      payload.alternating_pattern = form.alternate_weeks.slice(0, maxWeeks);
    }

    const res = await updateSchedule(id, payload);
    if (res.success) {
      success("Cập nhật lịch học thành công");
      setTimeout(() => {
        router.push(`/schedules/${id}`);
      }, 1500);
    } else {
      const errorMessage = res.message || "Không thể cập nhật lịch học";
      setErrorMsg(errorMessage);
      showError(errorMessage);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            onClick={handleGoBack}
            variant="outline"
            size="sm"
            icon={<ArrowLeftIcon />}
            className="flex-shrink-0"
          >
            Quay lại
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white truncate">Chỉnh sửa lịch học</h1>
            <p className="text-sm text-dark-4 dark:text-dark-6 mt-1 line-clamp-1">Cập nhật thông tin lịch học</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
        {error && !loading && <div className="mb-4 text-red-600">{error}</div>}
        {errorMsg && <div className="mb-4 text-red-600">{errorMsg}</div>}
        {successMsg && <div className="mb-4 text-primary">{successMsg}</div>}

        {/* Card: Thông tin chung */}
        <div className="rounded-lg bg-white p-3 sm:p-4 md:p-6 dark:bg-gray-800 mb-4 sm:mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <SelectInput
              label="Lớp học"
              name="class_id"
              value={form.class_id}
              onChange={(e) => setForm(prev => ({ ...prev, class_id: e.target.value }))}
              options={classSelectOptions}
              placeholder={classesLoading ? "Đang tải danh sách lớp..." : "Chọn lớp học"}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Trạng thái</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-pressed={form.is_active}
                  onClick={() => setForm(prev => ({ ...prev, is_active: !prev.is_active }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.is_active ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${form.is_active ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
                <span className="text-sm">{form.is_active ? 'Đang dùng' : 'Tạm dừng'}</span>
              </div>
            </div>
            <DateInput
              label="Ngày bắt đầu"
              name="start_date"
              value={form.start_date}
              handleChange={(e) => setForm(prev => ({ ...prev, start_date: e.target.value }))}
              placeholder="Chọn ngày bắt đầu"
            />
            <DateInput
              label="Ngày kết thúc"
              name="end_date"
              value={form.end_date}
              handleChange={(e) => setForm(prev => ({ ...prev, end_date: e.target.value }))}
              placeholder="Chọn ngày kết thúc"
            />
          </div>
        </div>

        {/* Card: Tần suất & Thứ trong tuần */}
        <div className="rounded-lg bg-white p-3 sm:p-4 md:p-6 dark:bg-gray-800 mb-4 sm:mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <SelectInput
              label="Tần suất"
              name="frequency"
              value={form.frequency}
              onChange={(e) => setForm(prev => ({ ...prev, frequency: e.target.value as any }))}
              options={frequencyOptions}
            />
            {form.frequency !== 'daily' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Thứ trong tuần</label>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {weekdayOptions.map(d => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => toggleDay(d.value)}
                      className={`px-2.5 sm:px-3 py-1 rounded-lg border text-xs sm:text-sm ${form.days_of_week.includes(d.value)
                        ? 'bg-primary text-white border-primary'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'}`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card: Khung giờ (moved up under Tần suất) */}
        <div className="rounded-lg bg-white p-3 sm:p-4 md:p-6 dark:bg-gray-800 mb-4 sm:mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Khung giờ</label>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="flex items-center gap-2 flex-1">
              <div className="flex-1">
                <InputGroup
                  type="time"
                  name="start_time"
                  value={startTime}
                  noLabel
                  inputProps={{
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setStartTime(e.target.value)
                  }}
                  className="w-full"
                />
              </div>
              <span className="text-gray-500 text-sm">-</span>
              <div className="flex-1">
                <InputGroup
                  type="time"
                  name="end_time"
                  value={endTime}
                  noLabel
                  inputProps={{
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setEndTime(e.target.value)
                  }}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Card: Giá trị mặc định cho buổi học (Template) */}
        <div className="rounded-lg bg-white p-3 sm:p-4 md:p-6 dark:bg-gray-800 mb-4 sm:mb-6">
          <div className="mb-3 sm:mb-4 pb-3 sm:pb-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Giá trị mặc định cho buổi học (Template)</h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-pastel/40 text-primary self-start sm:self-auto">
                Template
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Các giá trị này sẽ được sao chép vào buổi học khi tạo tự động. Có thể để trống và thiết lập ở từng buổi học cụ thể.
            </p>
          </div>
          <div className="mt-0 grid grid-cols-1 gap-4 sm:gap-6">
            {/* Chế độ mặc định */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Chế độ học (mặc định)</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                <label className={`inline-flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg border w-full cursor-pointer ${form.default_mode === 'offline' ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-gray-700'}`}>
                  <input type="radio" name="mode" checked={form.default_mode === 'offline'} onChange={() => setForm(prev => ({ ...prev, default_mode: 'offline' }))} className="flex-shrink-0" />
                  <span className="text-sm text-gray-800 dark:text-gray-200">Offline (Trực tiếp tại lớp)</span>
                </label>
                <label className={`inline-flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg border w-full cursor-pointer ${form.default_mode === 'online' ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-gray-700'}`}>
                  <input type="radio" name="mode" checked={form.default_mode === 'online'} onChange={() => setForm(prev => ({ ...prev, default_mode: 'online' }))} className="flex-shrink-0" />
                  <span className="text-sm text-gray-800 dark:text-gray-200">Online (Học qua Internet)</span>
                </label>
              </div>
            </div>

            {/* Config panels full width rows */}
            <div className="grid grid-cols-1 gap-3 sm:gap-4">
              {(form.alternate_by_week || form.default_mode === 'offline') && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-4 h-full">
                  <h4 className="text-sm font-medium mb-2 sm:mb-3 text-gray-900 dark:text-white">Cấu hình Offline (Mặc định)</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 sm:mb-3">
                    Các giá trị này sẽ được sao chép vào buổi học Offline khi tạo tự động
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:gap-3">
                    <input value={form.offline_room} onChange={(e) => setForm(prev => ({ ...prev, offline_room: e.target.value }))} placeholder="Phòng học" className="w-full rounded-lg border border-gray-300 bg-white px-3 sm:px-4 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                    <input value={form.offline_location} onChange={(e) => setForm(prev => ({ ...prev, offline_location: e.target.value }))} placeholder="Địa điểm cụ thể" className="w-full rounded-lg border border-gray-300 bg-white px-3 sm:px-4 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                    <textarea value={form.offline_note} onChange={(e) => setForm(prev => ({ ...prev, offline_note: e.target.value }))} rows={2} placeholder="Ghi chú" className="w-full rounded-lg border border-gray-300 bg-white px-3 sm:px-4 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                  </div>
                </div>
              )}
              {(form.alternate_by_week || form.default_mode === 'online') && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-4 h-full">
                  <h4 className="text-sm font-medium mb-2 sm:mb-3 text-gray-900 dark:text-white">Cấu hình Online (Mặc định)</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 sm:mb-3">
                    Các giá trị này sẽ được sao chép vào buổi học Online khi tạo tự động
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:gap-3">
                    <SelectInput
                      label="Nền tảng"
                      name="online_platform"
                      value={form.online_platform}
                      onChange={(e) => setForm(prev => ({ ...prev, online_platform: e.target.value }))}
                      options={onlinePlatformOptions}
                    />
                    <input value={form.online_link} onChange={(e) => setForm(prev => ({ ...prev, online_link: e.target.value }))} placeholder="Link meeting" className="w-full rounded-lg border border-gray-300 bg-white px-3 sm:px-4 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      <input value={form.online_meeting_id} onChange={(e) => setForm(prev => ({ ...prev, online_meeting_id: e.target.value }))} placeholder="Meeting ID" className="w-full rounded-lg border border-gray-300 bg-white px-3 sm:px-4 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                      <input value={form.online_password} onChange={(e) => setForm(prev => ({ ...prev, online_password: e.target.value }))} placeholder="Password" className="w-full rounded-lg border border-gray-300 bg-white px-3 sm:px-4 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card: Xen kẽ switch */}
        <div className="rounded-lg bg-white p-3 sm:p-4 md:p-6 dark:bg-gray-800 mb-4 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              aria-pressed={form.alternate_by_week}
              onClick={() => setForm(prev => ({ ...prev, alternate_by_week: !prev.alternate_by_week }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${form.alternate_by_week ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${form.alternate_by_week ? 'translate-x-5' : 'translate-x-1'}`}
              />
            </button>
            <span className="text-sm text-gray-700 dark:text-gray-300">Xen kẽ Online/Offline theo tuần</span>
          </div>
        </div>

        {/* Card: Pattern xen kẽ theo tuần */}
        {form.alternate_by_week && (
          <AlternatingWeeksPattern
            alternateWeeks={form.alternate_weeks}
            startDate={form.start_date}
            endDate={form.end_date}
            defaultMode={form.default_mode}
            onAddWeek={addWeek}
            onInitTwoWeeks={() => {
              setForm(prev => {
                const firstMode = prev.default_mode;
                const secondMode = prev.default_mode === 'offline' ? 'online' : 'offline';
                return { ...prev, alternate_weeks: [{ mode: firstMode }, { mode: secondMode }] };
              });
            }}
            onRemoveWeek={removeWeek}
            onUpdateWeek={(index, mode) => updateWeek(index, { mode })}
          />
        )}



        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-3 sm:gap-4">
          <ButtonLink
            href={`/schedules/${id}`}
            variant="outline"
            size="sm"
            className="w-full sm:w-auto justify-center"
          >
            Hủy
          </ButtonLink>
          <Button
            type="submit"
            disabled={saving}
            loading={saving}
            size="sm"
            variant="primary"
            icon={<CheckCircleIcon />}
            className="w-full sm:w-auto justify-center"
          >
            <span className="sm:hidden">Cập nhật</span>
            <span className="hidden sm:inline">Cập nhật lịch học</span>
          </Button>
        </div>
      </form>
    </div>
  );
}



