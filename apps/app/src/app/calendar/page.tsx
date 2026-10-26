"use client";
import { useState, useMemo, useEffect, useRef, Suspense } from "react";
import { useSchedules, useClasses, useStudentClasses } from "@/hooks/use-api";
import { useAuthContext } from "@/contexts/auth-context";
import { isStudent, canManageClass } from "@/lib/authz";
import { useStudentId } from "@/hooks/use-student-id";
import { apiClient } from "@/lib/api-client";
import CalendarView from "./_components/calendar-view";
import CalendarFilters from "./_components/calendar-filters";
import { CalendarIcon, ListBulletIcon, PlusIcon } from "@heroicons/react/24/outline";
import ButtonLink from "@/components/Common/ButtonLink";
import { getObjId, idsEqual } from "@/lib/id-utils";
import { getCachedValue, setCachedValue } from "@/lib/client-cache";
import { SESSION_CACHE_TTL } from "@/config/cache";
import { useListPage } from "@/hooks/use-list-page";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useLockContext } from "@/contexts/lock-context";
import { useErrorDisplay } from "@/components/Common/ErrorDisplay";


function normalizeSessions(data: any): any[] {
  if (!data) return [];
  // Handle various API response structures
  const rawData = data.data !== undefined ? data.data : data;
  if (Array.isArray(rawData)) return rawData;
  if (rawData.sessions && Array.isArray(rawData.sessions)) return rawData.sessions;
  if (rawData.data && Array.isArray(rawData.data)) return rawData.data;
  if (rawData.weeks && Array.isArray(rawData.weeks)) {
    return rawData.weeks.flatMap((week: any) => week.sessions || []);
  }
  return [];
}

function CalendarContent() {
  const { user } = useAuthContext();
  const { actionsLocked, planFeatureMessage } = useLockContext();
  const { renderError } = useErrorDisplay("Lịch học");
  const isStudentUser = isStudent(user);
  const { studentId } = useStudentId();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Get student classes to detect paused enrollments
  const shouldLoadStudentClasses = isStudentUser && !!studentId && !actionsLocked;
  const { classes: studentClasses } = useStudentClasses(
    shouldLoadStudentClasses ? studentId : '0'
  );

  // Build a map of paused class IDs for quick lookup
  const pausedClassIds = useMemo(() => {
    if (!shouldLoadStudentClasses || !studentClasses) return new Set<string>();
    const ids = new Set<string>();
    studentClasses.forEach((cls: any) => {
      if (cls?.enrollment?.is_paused) {
        const identifier = getObjId(cls) || getObjId(cls.class);
        if (identifier) ids.add(identifier);
      }
    });
    return ids;
  }, [shouldLoadStudentClasses, studentClasses]);

  // Use combined hook for filters (class_id, mode, status)
  const {
    filters,
    updateFilter,
    resetFilters,
    apiFilters,
  } = useListPage({
    defaultPage: 1,
    defaultPerPage: 200,
    filterKeys: ["class_id", "mode", "status"],
    filterDefaults: {
      class_id: "all",
      mode: "all",
      status: "all",
    },
  });

  // Extract individual filters for easier access
  const selectedClassId = filters.class_id || "all";
  const selectedMode = filters.mode || "all";
  const selectedStatus = filters.status || "all";

  const hasActiveFilters = selectedClassId !== "all" || selectedMode !== "all" || selectedStatus !== "all";

  // Handle month separately (Date object needs special handling)
  // Read month from URL or default to current month
  const selectedMonthFromUrl = useMemo(() => {
    const monthParam = searchParams.get("month");
    if (monthParam) {
      const [year, month] = monthParam.split("-").map(Number);
      if (!isNaN(year) && !isNaN(month) && month >= 1 && month <= 12) {
        return new Date(year, month - 1, 1);
      }
    }
    return new Date();
  }, [searchParams]);

  // Initialize state from URL on mount
  const [selectedMonth, setSelectedMonth] = useState<Date>(selectedMonthFromUrl);

  // Track if user is actively changing month (to prevent URL sync from overriding user action)
  const isUserChangingMonthRef = useRef(false);

  // Custom setter for selectedMonth that tracks user actions
  const handleMonthChange = (newMonth: Date) => {
    isUserChangingMonthRef.current = true;
    setSelectedMonth(newMonth);
  };

  // Sync month to URL when user changes it
  useEffect(() => {
    if (!isUserChangingMonthRef.current) return;

    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
    const currentMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

    const params = new URLSearchParams(searchParams.toString());
    if (monthStr === currentMonthStr) {
      params.delete("month");
    } else {
      params.set("month", monthStr);
    }

    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    if (newUrl !== `${pathname}${searchParams.toString() ? '?' + searchParams.toString() : ''}`) {
      router.replace(newUrl, { scroll: false });
    }
  }, [selectedMonth, pathname, router, searchParams]);

  // Clear flag when URL updates (after user action)
  useEffect(() => {
    if (isUserChangingMonthRef.current) {
      // Check if URL matches selectedMonth
      const year = selectedMonth.getFullYear();
      const month = selectedMonth.getMonth();
      const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
      const currentMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
      const expectedUrlMonth = monthStr === currentMonthStr ? null : monthStr;
      const actualUrlMonth = searchParams.get("month");

      // If URL matches what user selected, clear the flag
      if (expectedUrlMonth === actualUrlMonth) {
        isUserChangingMonthRef.current = false;
      }
    }
  }, [searchParams, selectedMonth]);

  // Sync selectedMonth when URL changes (back/forward button) - but NOT when user is changing
  useEffect(() => {
    // Skip if user just changed the month
    if (isUserChangingMonthRef.current) {
      return; // User action in progress, don't sync from URL
    }

    // Only sync from URL if it's different from current state (back/forward navigation)
    const currentDate = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
    const urlDate = new Date(selectedMonthFromUrl.getFullYear(), selectedMonthFromUrl.getMonth(), 1);
    if (urlDate.getTime() !== currentDate.getTime()) {
      setSelectedMonth(selectedMonthFromUrl);
    }
  }, [selectedMonthFromUrl, selectedMonth, searchParams]);

  const schedulesFilters = useMemo(() => {
    return {
      ...apiFilters,
      per_page: apiFilters.per_page ?? 200,
    };
  }, [apiFilters]);

  // Fetch data
  const { data: schedulesData, loading: schedulesLoading, error: schedulesError, refetch: refetchSchedules, permissions: schedulesPermissions } = useSchedules(actionsLocked ? undefined : schedulesFilters);
  // Fetch all classes for filter dropdown (not filtered)
  const { data: classesData, loading: classesLoading, error: classesError, refetch: refetchClasses, permissions: classesPermissions } = useClasses(actionsLocked ? undefined : { per_page: 1000 }, !actionsLocked);

  // Use permissions from API response, fallback to false if not available
  const canView = schedulesPermissions?.can_view ?? classesPermissions?.can_view ?? true; // Default true cho view
  const canManage = schedulesPermissions?.can_manage ?? classesPermissions?.can_manage ?? false;

  const schedules = useMemo(() => {
    return Array.isArray(schedulesData?.data)
      ? schedulesData.data
      : Array.isArray(schedulesData)
        ? schedulesData
        : [];
  }, [schedulesData]);
  const classes = Array.isArray(classesData) ? classesData : [];

  // Fetch sessions for all schedules to get status
  const [sessionsByDate, setSessionsByDate] = useState<Record<string, any[]>>({});
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [, setLastFetchedIds] = useState<string>('');

  // Track fetching state to avoid redundant calls within the same cycle
  const isFetchingRef = useRef(false);

  // Memoize schedule IDs string and month key to avoid unnecessary fetches
  const scheduleIdsStr = useMemo(() => {
    return schedules
      .map(getObjId)
      .filter(Boolean)
      .sort()
      .join(',');
  }, [schedules]);

  // Calculate date range for selected month
  const monthDateRange = useMemo(() => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
    return { startDate, endDate };
  }, [selectedMonth]);

  // Memoize cache key to include month
  const cacheKeyStr = useMemo(() => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    return `${scheduleIdsStr}:${year}-${month}`;
  }, [scheduleIdsStr, selectedMonth]);

  useEffect(() => {
    if (!scheduleIdsStr) {
      setSessionsByDate(prev => Object.keys(prev).length === 0 ? prev : {});
      setLastFetchedIds('');
      return;
    }

    // Force fetch every time dependencies change
    // if (cacheKeyStr === lastFetchedIds) {
    //   return;
    // }

    const fetchSessions = async () => {
      if (isFetchingRef.current) return;

      const mainCacheKey = `sessions_v2:${cacheKeyStr}`;

      // Step 1: Load from cache for speed
      const cached = getCachedValue<Record<string, any[]>>(mainCacheKey);
      if (cached && Object.keys(cached).length > 0) {
        setSessionsByDate(cached);
      } else {
        setSessionsLoading(true);
      }

      isFetchingRef.current = true;
      const sessionsMap: Record<string, any[]> = {};

      try {
        const sessionPromises = schedules.map(async (schedule: any) => {
          const scheduleId = getObjId(schedule);
          if (!scheduleId) return;

          try {
            const response = await apiClient.getScheduleSessions(scheduleId);
            const sessions = normalizeSessions(response);

            if (Array.isArray(sessions)) {
              sessions.forEach((session: any) => {
                const sessionDate = session.session_date || session.date;
                if (!sessionDate) return;

                const dateKey = sessionDate.split('T')[0];
                if (!sessionsMap[dateKey]) sessionsMap[dateKey] = [];

                const sessionId = getObjId(session);

                // IMPORTANT: Ensure we include all necessary data for filtering and display
                sessionsMap[dateKey].push({
                  ...session,
                  _id: sessionId,
                  id: sessionId,
                  schedule_id: scheduleId,
                  class_id: getObjId(session.class_id || session.class || schedule.class_id || schedule.class),
                  schedule_name: schedule.class?.name || schedule.class_name || `Lịch #${scheduleId}`,
                  schedule: schedule,
                });
              });
            }
          } catch (err) {
            console.error(`Error fetching sessions for ${scheduleId}:`, err);
          }
        });

        await Promise.all(sessionPromises);

        // Update state and cache only if we actually found sessions
        if (Object.keys(sessionsMap).length > 0) {
          setSessionsByDate(sessionsMap);
          setCachedValue(mainCacheKey, sessionsMap, SESSION_CACHE_TTL);
        }
        setLastFetchedIds(cacheKeyStr);
      } catch (err) {
        console.error('Error in fetchSessions:', err);
      } finally {
        setSessionsLoading(false);
        isFetchingRef.current = false;
      }
    };

    fetchSessions();
  }, [cacheKeyStr, monthDateRange, scheduleIdsStr, selectedMonth, schedules]);

  // Filter schedules based on selected filters
  const filteredSchedules = useMemo(() => {
    return schedules.filter((schedule: any) => {
      const classId = getObjId(schedule.class_id ? { id: schedule.class_id } : (schedule.class || {}));

      if (selectedClassId !== "all" && !idsEqual(classId, selectedClassId)) return false;
      if (selectedMode !== "all" && schedule.default_mode !== selectedMode) return false;
      if (selectedStatus !== "all" && schedule.status !== selectedStatus) return false;
      if (isStudentUser && pausedClassIds.has(String(classId))) return false;

      return true;
    });
  }, [schedules, selectedClassId, selectedMode, selectedStatus, isStudentUser, pausedClassIds]);

  // Filter sessionsByDate based on filtered schedules
  const filteredSessionsByDate = useMemo(() => {
    const filteredScheduleIds = new Set(filteredSchedules.map(getObjId));
    const filtered: Record<string, any[]> = {};

    Object.entries(sessionsByDate).forEach(([dateKey, sessions]) => {
      const matchingSessions = sessions.filter((session: any) => {
        const sId = getObjId(session.schedule_id || session.schedule);
        if (!filteredScheduleIds.has(sId)) return false;

        if (session.status === 'completed') return false;

        if (isStudentUser) {
          const classId = getObjId(session.class_id || session.class || session.schedule?.class);
          if (pausedClassIds.has(classId)) return false;
        }

        return true;
      });

      if (matchingSessions.length > 0) filtered[dateKey] = matchingSessions;
    });

    return filtered;
  }, [sessionsByDate, filteredSchedules, isStudentUser, pausedClassIds]);

  if (actionsLocked || planFeatureMessage) {
    return renderError();
  }

  // Check view permission - chỉ block khi không có quyền xem
  if (!schedulesLoading && !classesLoading && (schedulesPermissions !== undefined || classesPermissions !== undefined) && !canView) {
    return renderError(undefined, undefined, false);
  }

  // Check API errors
  if (schedulesError && !schedulesLoading) {
    return renderError(schedulesError, () => refetchSchedules());
  }

  if (classesError && !classesLoading) {
    return renderError(classesError, () => refetchClasses());
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 sm:h-6 sm:w-6" />
            Lịch học
          </h1>
          <p className="text-sm sm:text-base text-dark-4 dark:text-dark-6 mt-1">
            {isStudentUser
              ? "Xem lịch học của các lớp bạn tham gia"
              : "Xem và quản lý lịch học theo tuần/tháng"
            }
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch lg:items-center gap-2">
          <ButtonLink
            href="/schedules"
            variant="outline"
            size="sm"
            icon={<ListBulletIcon />}
            className="w-full sm:w-auto lg:w-auto justify-center"
          >
            Xem dạng danh sách
          </ButtonLink>
          {(canManage || canManageClass(user)) && (
            <ButtonLink
              href="/schedules/create"
              variant="primary"
              size="sm"
              icon={<PlusIcon />}
              className="w-full sm:w-auto lg:w-auto justify-center"
            >
              Tạo lịch học mới
            </ButtonLink>
          )}
        </div>
      </div>

      {/* Filters */}
      <CalendarFilters
        classes={classes}
        selectedClassId={selectedClassId}
        selectedMonth={selectedMonth}
        selectedMode={selectedMode}
        selectedStatus={selectedStatus}
        onClassChange={(classId) => updateFilter("class_id", classId)}
        onMonthChange={handleMonthChange}
        onModeChange={(mode) => updateFilter("mode", mode)}
        onStatusChange={(status) => updateFilter("status", status)}
        isStudent={isStudentUser}
        classesLoading={classesLoading}
        onClearFilters={resetFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Calendar View */}
      <CalendarView
        schedules={filteredSchedules}
        sessionsByDate={filteredSessionsByDate}
        selectedMonth={selectedMonth}
        loading={schedulesLoading || sessionsLoading}
        classes={classes}
        pausedClassIds={pausedClassIds}
        isStudent={isStudentUser}
      />
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
      </div>
    }>
      <CalendarContent />
    </Suspense>
  );
}

