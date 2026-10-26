"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useMemo, useState, useEffect, Suspense } from "react";
import { useCreateSchedule, useClasses } from "@/hooks/use-api";
import { useGoBack } from "@/hooks/use-go-back";
import { useAuthContext } from "@/contexts/auth-context";
import { useResourceGuard } from "@/lib/permission-guards";
import DateInput from "@/components/FormElements/DateInput";
import SelectInput from "@/components/FormElements/SelectInput";
import InputGroup from "@/components/FormElements/InputGroup";
import { ArrowLeftIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { useNotification } from "@/hooks/use-notification";
import { extractErrorMessage, extractFieldErrors } from "@/lib/api-error-utils";
import ButtonLink from "@/components/Common/ButtonLink";
import Button from "@/components/Common/Button";
import AlternatingWeeksPattern from "@/components/Schedules/AlternatingWeeksPattern";
import { getObjId } from "@/lib/id-utils";


function CreateScheduleContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuthContext();
  const handleGoBack = useGoBack('/schedules');

  // Use resource guard to protect this route
  const { hasAccess, isChecking } = useResourceGuard(
    user,
    'create',
    'schedule',
    '/403'
  );

  const classIdFromQuery = searchParams.get("class_id") || "";
  const { data: classes, loading: classesLoading } = useClasses();
  const { mutate: createSchedule, loading } = useCreateSchedule();

  const [form, setForm] = useState({
    class_id: classIdFromQuery,
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { success: showSuccess, error: showError } = useNotification();

  const classOptions = useMemo(() => classes || [], [classes]);
  const classSelectOptions = useMemo(
    () =>
      classOptions.map((c: any) => ({
        value: getObjId(c),
        label: c.name,
      })),
    [classOptions]
  );

  const frequencyOptions = [
    { value: "daily", label: "Hàng ngày" },
    { value: "weekly", label: "Hàng tuần" },
    { value: "monthly", label: "Hàng tháng" },
  ];

  const onlinePlatformOptions = [
    { value: "", label: "Chọn nền tảng" },
    { value: "zoom", label: "Zoom" },
    { value: "google_meet", label: "Google Meet" },
    { value: "microsoft_teams", label: "Microsoft Teams" },
    { value: "other", label: "Khác" },
  ];


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
        // alternate starting from default_mode
        const nextMode = (i % 2 === 0)
          ? prev.default_mode
          : (prev.default_mode === 'offline' ? 'online' : 'offline');
        fill.push({ mode: nextMode });
      }
      return { ...prev, alternate_weeks: [...preserved, ...fill] };
    });
  }, [form.alternate_by_week, form.start_date, form.end_date, form.default_mode]);

  // Show nothing while checking or redirecting (after all hooks)
  if (isChecking || !hasAccess) {
    return null;
  }

  const addWeek = () => {
    setForm(prev => {
      // limit by weeks between start_date and end_date when available
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
      const lastMode = prev.alternate_weeks[prev.alternate_weeks.length - 1]?.mode;
      const nextMode =
        lastMode === undefined
          ? prev.default_mode
          : lastMode === "offline"
            ? "online"
            : "offline";
      return { ...prev, alternate_weeks: [...prev.alternate_weeks, { mode: nextMode }] };
    });
  };
  const removeWeek = (index: number) => {
    setForm(prev => ({ ...prev, alternate_weeks: prev.alternate_weeks.filter((_, i) => i !== index) }));
  };
  const updateWeek = (index: number, patch: Partial<{ mode: "offline" | "online"; room?: string; online_platform?: string; online_link?: string }>) => {
    setForm(prev => ({
      ...prev,
      alternate_weeks: prev.alternate_weeks.map((w, i) => (i === index ? { ...w, ...patch } : w))
    }));
  };

  // no multiple time slots; backend expects single start_time/end_time

  const toggleDay = (day: number) => {
    setForm(prev => (
      prev.days_of_week.includes(day)
        ? { ...prev, days_of_week: prev.days_of_week.filter(d => d !== day) }
        : { ...prev, days_of_week: [...prev.days_of_week, day] }
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Clear previous errors and let the API return validation messages
    setFieldErrors({});
    const payload: {
      class_id: string;
      start_date: string;
      end_date?: string;
      recurring_type: "daily" | "weekly" | "monthly";
      recurring_days?: number[];
      start_time?: string;
      end_time?: string;
      default_mode: "offline" | "online";
      is_active: boolean;
      room?: string;
      location?: string;
      notes?: string;
      online_platform?: string;
      online_meeting_url?: string;
      online_meeting_id?: string;
      online_meeting_password?: string;
      is_alternating?: boolean;
      alternating_pattern?: Array<{ mode: "offline" | "online" }>;
    } = {
      class_id: form.class_id,
      start_date: form.start_date,
      end_date: form.end_date || undefined,
      recurring_type: form.frequency,
      recurring_days: form.frequency === 'weekly' && form.days_of_week.length ? form.days_of_week : undefined,
      start_time: startTime || undefined,
      end_time: endTime || undefined,
      default_mode: form.default_mode,
      is_active: form.is_active,
      // offline (top-level)
      room: form.offline_room || undefined,
      location: form.offline_location || undefined,
      notes: form.offline_note || undefined,
      // online (top-level)
      online_platform: form.online_platform || undefined,
      online_meeting_url: form.online_link || undefined,
      online_meeting_id: form.online_meeting_id || undefined,
      online_meeting_password: form.online_password || undefined,
    };


    if (form.alternate_by_week) {
      payload.is_alternating = true;
      // cap pattern length to weeks in date range
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

    const res = await createSchedule(payload);
    if (res.success) {
      showSuccess("Tạo lịch học thành công");
      setTimeout(() => router.push("/schedules"), 700);
    } else {
      // Sử dụng utility function để extract errors
      const errors = extractFieldErrors(res);
      const errorMessage = extractErrorMessage(res, "Có lỗi xảy ra khi tạo lịch học");

      setFieldErrors(errors);
      showError(errorMessage);
    }
  };

  const weekdayOptions = [
    { value: 1, label: "Thứ 2" },
    { value: 2, label: "Thứ 3" },
    { value: 3, label: "Thứ 4" },
    { value: 4, label: "Thứ 5" },
    { value: 5, label: "Thứ 6" },
    { value: 6, label: "Thứ 7" },
    { value: 0, label: "Chủ nhật" },
  ];

  return (
    <div className="space-y-6">
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
            <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white truncate">Tạo lịch học mới</h1>
            <p className="text-sm text-dark-4 dark:text-dark-6 mt-1 line-clamp-1">Thiết lập lịch học cho lớp học</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">

        {/* Card: Thông tin chung */}
        <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <SelectInput
                label="Lớp học"
                name="class_id"
                value={form.class_id}
                required
                onChange={(e) => {
                  setForm(prev => ({ ...prev, class_id: e.target.value }));
                  if (fieldErrors.class_id) {
                    setFieldErrors(prev => {
                      const newErrors = { ...prev };
                      delete newErrors.class_id;
                      return newErrors;
                    });
                  }
                }}
                options={classSelectOptions}
                placeholder={classesLoading ? "Đang tải danh sách lớp..." : "Chọn lớp học"}
              />
              {fieldErrors.class_id && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.class_id}</p>
              )}
            </div>
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
            <div>
              <DateInput
                label="Ngày bắt đầu"
                name="start_date"
                value={form.start_date}
                required
                handleChange={(e) => {
                  setForm(prev => ({ ...prev, start_date: e.target.value }));
                  if (fieldErrors.start_date) {
                    setFieldErrors(prev => {
                      const newErrors = { ...prev };
                      delete newErrors.start_date;
                      return newErrors;
                    });
                  }
                }}
                placeholder="Chọn ngày bắt đầu"
              />
              {fieldErrors.start_date && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.start_date}</p>
              )}
            </div>
            <div>
              <DateInput
                label="Ngày kết thúc"
                name="end_date"
                value={form.end_date}
                handleChange={(e) => {
                  setForm(prev => ({ ...prev, end_date: e.target.value }));
                  if (fieldErrors.end_date) {
                    setFieldErrors(prev => {
                      const newErrors = { ...prev };
                      delete newErrors.end_date;
                      return newErrors;
                    });
                  }
                }}
                placeholder="Chọn ngày kết thúc"
              />
              {fieldErrors.end_date && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.end_date}</p>
              )}
            </div>
          </div>
        </div>

        {/* Card: Thứ trong tuần */}
        <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <div className="flex flex-wrap gap-2">
                  {weekdayOptions.map(d => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => toggleDay(d.value)}
                      className={`px-3 py-1 rounded-lg border text-sm ${form.days_of_week.includes(d.value)
                        ? 'bg-primary text-white border-primary'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'}`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                {fieldErrors.recurring_days && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.recurring_days}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Card: Khung giờ (moved up under Tần suất) */}
        <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800 mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Khung giờ</label>
          <div className="flex flex-col md:flex-row gap-2 md:items-center">
            <div className="flex items-center gap-2 flex-1">
              <div className="flex-1">
                <InputGroup
                  type="time"
                  name="start_time"
                  value={startTime}
                  noLabel
                  required
                  inputProps={{
                    'aria-required': true,
                    'aria-invalid': !!fieldErrors.start_time,
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                      setStartTime(e.target.value);
                      if (fieldErrors.start_time) {
                        setFieldErrors(prev => { const n = { ...prev }; delete n.start_time; return n; });
                      }
                    }
                  }}
                  className="w-full"
                />
              </div>
              <span className="text-gray-500">-</span>
              <div className="flex-1">
                <InputGroup
                  type="time"
                  name="end_time"
                  value={endTime}
                  noLabel
                  required
                  inputProps={{
                    'aria-required': true,
                    'aria-invalid': !!fieldErrors.end_time,
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                      setEndTime(e.target.value);
                      if (fieldErrors.end_time) {
                        setFieldErrors(prev => { const n = { ...prev }; delete n.end_time; return n; });
                      }
                    }
                  }}
                  className="w-full"
                />
              </div>
            </div>
          </div>
          {fieldErrors.start_time && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.start_time}</p>
          )}
          {fieldErrors.end_time && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.end_time}</p>
          )}
        </div>

        {/* Card: Giá trị mặc định cho buổi học (Template) */}
        <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800 mb-6">
          <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Giá trị mặc định cho buổi học (Template)</h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-pastel/40 text-primary">
                Template
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Các giá trị này sẽ được sao chép vào buổi học khi tạo tự động. Có thể để trống và thiết lập ở từng buổi học cụ thể.
            </p>
          </div>
          <div className="mt-0 grid grid-cols-1 gap-6">
            {/* Chế độ mặc định & xen kẽ */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Chế độ học (mặc định)</label>
              <div className="grid grid-cols-2 gap-3">
                <label className={`inline-flex items-center gap-3 p-3 rounded-lg border w-full ${form.default_mode === 'offline' ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-gray-700'}`}>
                  <input type="radio" name="mode" checked={form.default_mode === 'offline'} onChange={() => setForm(prev => ({ ...prev, default_mode: 'offline' }))} />
                  <span className="text-gray-800 dark:text-gray-200">Offline (Trực tiếp tại lớp)</span>
                </label>
                <label className={`inline-flex items-center gap-3 p-3 rounded-lg border w-full ${form.default_mode === 'online' ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-gray-700'}`}>
                  <input type="radio" name="mode" checked={form.default_mode === 'online'} onChange={() => setForm(prev => ({ ...prev, default_mode: 'online' }))} />
                  <span className="text-gray-800 dark:text-gray-200">Online (Học qua Internet)</span>
                </label>
              </div>
              {/* Xen kẽ switch moved below, above Pattern section */}
            </div>

            {/* Config panels side-by-side */}
            <div className="grid grid-cols-1 gap-4">
              {(form.alternate_by_week || form.default_mode === 'offline') && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 h-full">
                  <h4 className="font-medium mb-3 text-gray-900 dark:text-white">Cấu hình Offline (Mặc định)</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Các giá trị này sẽ được sao chép vào buổi học Offline khi tạo tự động
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    <input value={form.offline_room} onChange={(e) => setForm(prev => ({ ...prev, offline_room: e.target.value }))} placeholder="Phòng học" className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                    <input value={form.offline_location} onChange={(e) => setForm(prev => ({ ...prev, offline_location: e.target.value }))} placeholder="Địa điểm cụ thể" className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                    <textarea value={form.offline_note} onChange={(e) => setForm(prev => ({ ...prev, offline_note: e.target.value }))} rows={2} placeholder="Ghi chú" className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                  </div>
                </div>
              )}
              {(form.alternate_by_week || form.default_mode === 'online') && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 h-full">
                  <h4 className="font-medium mb-3 text-gray-900 dark:text-white">Cấu hình Online (Mặc định)</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Các giá trị này sẽ được sao chép vào buổi học Online khi tạo tự động
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    <SelectInput
                      label="Nền tảng"
                      name="online_platform"
                      value={form.online_platform}
                      onChange={(e) => setForm(prev => ({ ...prev, online_platform: e.target.value }))}
                      options={onlinePlatformOptions}
                    />
                    <input value={form.online_link} onChange={(e) => setForm(prev => ({ ...prev, online_link: e.target.value }))} placeholder="Link meeting" className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input value={form.online_meeting_id} onChange={(e) => setForm(prev => ({ ...prev, online_meeting_id: e.target.value }))} placeholder="Meeting ID" className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                      <input value={form.online_password} onChange={(e) => setForm(prev => ({ ...prev, online_password: e.target.value }))} placeholder="Password" className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card: Xen kẽ Online/Offline theo tuần (switch) */}
        <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800 mb-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-pressed={form.alternate_by_week}
              onClick={() => setForm(prev => ({ ...prev, alternate_by_week: !prev.alternate_by_week }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.alternate_by_week ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${form.alternate_by_week ? 'translate-x-5' : 'translate-x-1'}`}
              />
            </button>
            <span className="text-sm">Xen kẽ Online/Offline theo tuần</span>
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



        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 sm:gap-2">
          <ButtonLink
            href="/schedules"
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
            loading={loading}
            icon={<CheckCircleIcon />}
            className="w-full sm:w-auto justify-center"
          >
            Tạo lịch học
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function CreateSchedulePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
      </div>
    }>
      <CreateScheduleContent />
    </Suspense>
  );
}

