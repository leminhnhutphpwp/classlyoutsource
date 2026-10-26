"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  useNotification,
  useDeleteNotification,
  useNotificationRecipients,
  useSendNotificationEmailBatch,
  useResendFailedNotificationEmails,
} from "@/hooks/use-api";
import { useAuthorization } from "@/lib/authz";
import {
  ArrowLeftIcon,
  CalendarIcon,
  PencilIcon,
  TrashIcon,
  ArrowPathIcon,
  PaperAirplaneIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import ConfirmDeleteDialog from "@/components/Common/ConfirmDeleteDialog";
import ButtonLink from "@/components/Common/ButtonLink";
import Button from "@/components/Common/Button";
import Pagination from "@/components/Common/Pagination";
import { useStudentGuard } from "@/hooks/use-role-guard";
import { useGoBack } from "@/hooks/use-go-back";
import InputGroup from "@/components/FormElements/InputGroup";
import SelectInput from "@/components/FormElements/SelectInput";
import { useClasses, useStudents } from "@/hooks/use-api";
import { getObjId, idsEqual } from "@/lib/id-utils";
import UserInfoBox from "@/components/User/UserInfoBox";
import { useErrorDisplay } from "@/components/Common/ErrorDisplay";

export default function NotificationDetailsPage() {
  const { isBlocked } = useStudentGuard(); // Block students from accessing this page
  const params = useParams();
  const router = useRouter();
  const notificationId = params.id as string;
  const { can } = useAuthorization();
  const handleGoBack = useGoBack('/notifications');
  const { renderError } = useErrorDisplay("Chi tiết thông báo");
  const { data: notification, loading, error, permissions, refetch: refetchNotification, refresh: refreshNotification } = useNotification(notificationId);
  const { mutate: deleteNotification, loading: deleting } = useDeleteNotification();
  const isEmailChannel = notification?.channel === 'email';
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [recipientStatusFilter, setRecipientStatusFilter] = useState<'all' | 'pending' | 'sent' | 'failed' | 'skipped'>('all');
  const [perPage, setPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [batchProgress, setBatchProgress] = useState<{
    processed: number;
    total_in_batch: number;
    sent_batch: number;
    failed_batch: number;
    pending_left: number;
  } | null>(null);
  const { data: classes } = useClasses();
  useStudents();
  const [, setIsPolling] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Recipients query
  const recipientFilters = useMemo(() => {
    return {
      status: recipientStatusFilter === 'all' ? undefined : recipientStatusFilter,
      per_page: perPage,
      page: currentPage,
    };
  }, [recipientStatusFilter, perPage, currentPage]);

  const {
    data: recipientResponse,
    loading: recipientsLoading,
    error: recipientsError,
    refetch: refetchRecipients,
    refresh: refreshRecipients,
    meta: recipientsMeta,
  } = useNotificationRecipients(isEmailChannel ? notificationId : "", recipientFilters);

  const recipients = useMemo(
    () => recipientResponse?.data || recipientResponse || [],
    [recipientResponse]
  );
  const buildKey = (item: any) => `${getObjId(item.user_id) || 'u'}-${getObjId(item.student_id) || 's'}`;

  const toggleSelect = (item: any) => {
    const key = buildKey(item);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectPage = (checked: boolean) => {
    if (checked) {
      const next = new Set(selectedKeys);
      recipients.forEach((item: any) => {
        if (item.email_verified) next.add(buildKey(item));
      });
      setSelectedKeys(next);
    } else {
      const next = new Set(selectedKeys);
      recipients.forEach((item: any) => next.delete(buildKey(item)));
      setSelectedKeys(next);
    }
  };

  const selectedUserIds = useMemo(
    () =>
      recipients
        .filter((item: any) => selectedKeys.has(buildKey(item)) && item.user_id)
        .map((item: any) => getObjId(item.user_id)),
    [recipients, selectedKeys]
  );
  const selectedStudentIds = useMemo(
    () =>
      recipients
        .filter((item: any) => selectedKeys.has(buildKey(item)) && item.student_id)
        .map((item: any) => getObjId(item.student_id)),
    [recipients, selectedKeys]
  );

  const batchProcessed = batchProgress?.processed ?? 0;
  const batchTotal = batchProgress?.total_in_batch ?? 0;
  const batchSent = batchProgress?.sent_batch ?? 0;
  const batchFailed = batchProgress?.failed_batch ?? 0;
  const batchPendingLeft = batchProgress?.pending_left ?? 0;
  const batchProgressPct =
    batchTotal > 0 ? Math.min(100, Math.round((batchProcessed / batchTotal) * 100)) : 0;
  const batchFailPct =
    batchTotal > 0 ? Math.min(100, Math.round((batchFailed / batchTotal) * 100)) : 0;

  // Overall progress calculation
  const metaStats = (recipientsMeta as any)?.statistics || {};
  const totalRecipients =
    (notification as any)?.total_recipients ||
    (notification as any)?.recipient_count ||
    (recipientsMeta as any)?.total ||
    metaStats.total ||
    (Number(metaStats.sent || 0) + Number(metaStats.failed || 0) + Number(metaStats.pending || 0) + Number(metaStats.skipped || 0)) ||
    0;

  const sentCount = Number(notification?.sent_count ?? metaStats.sent ?? 0);
  const failedCount = Number(notification?.failed_count ?? metaStats.failed ?? 0);
  const skippedCount = Number(metaStats.skipped ?? 0);

  // Progress based on actual processed vs total
  const processedRecipients = sentCount + failedCount + skippedCount;
  const overallProgressPct = totalRecipients > 0 ? Math.min(100, Math.round((processedRecipients / totalRecipients) * 100)) : 0;
  const overallFailPct = totalRecipients > 0 ? Math.min(100, Math.round((failedCount / totalRecipients) * 100)) : 0;

  const pendingCount = totalRecipients > 0 ? Math.max(0, totalRecipients - processedRecipients) : 0;

  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return;
    setIsPolling(true);
    pollingIntervalRef.current = setInterval(() => {
      refreshNotification();
      refreshRecipients();
    }, 5000);
  }, [refreshNotification, refreshRecipients]);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  // Poll if status is 'processing'
  useEffect(() => {
    if (notification?.status === 'processing') {
      startPolling();
    } else {
      stopPolling();
    }
    return () => stopPolling();
  }, [notification?.status, startPolling, stopPolling]);

  // Actions: send batch & resend failed
  const { mutate: sendEmailBatch, loading: sendingBatch } = useSendNotificationEmailBatch();
  const { mutate: resendFailed, loading: resendingFailed } = useResendFailedNotificationEmails();

  // Use permissions from API response
  const canView = permissions?.can_view ?? true; // Default true cho view

  // Mark initial load complete to avoid full skeleton on refetch
  useEffect(() => {
    if (!loading && notification && !initialLoaded) {
      setInitialLoaded(true);
    }
  }, [loading, notification, initialLoaded]);

  // Block students - this page is for tutors only (students should use /my-notifications)
  if (isBlocked) {
    return null;
  }

  if (typeof window !== "undefined" && !(can("view", "notification") || can("view_any", "notification"))) {
    router.replace("/403");
    return null;
  }

  // Check view permission - chỉ block khi không có quyền xem
  if (!loading && notification && permissions !== undefined && !canView) return renderError(undefined, undefined, false);

  if (loading && !initialLoaded) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
          <div className="space-y-4">
            <div className="h-6 w-1/2 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="h-24 w-full rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !notification) {
    return renderError(error || "Không tìm thấy thông báo", () => refetchNotification());
  }

  return (
    <div className="space-y-6">
      <ConfirmDeleteDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          const res = await deleteNotification(notificationId);
          if (res.success) router.push('/notifications');
        }}
        loading={deleting}
        message="Bạn có chắc chắn muốn xóa thông báo này? Hành động không thể hoàn tác."
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
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
            {notification.title}
          </h1>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <ButtonLink
            href={`/notifications/${notificationId}/edit`}
            variant="outline"
            size="sm"
            icon={<PencilIcon />}
            className="flex-1 sm:flex-initial justify-center"
            disabled={!can("update", "notification")}
          >
            Chỉnh sửa
          </ButtonLink>
          <Button
            onClick={() => setConfirmDelete(true)}
            variant="danger"
            size="sm"
            icon={<TrashIcon />}
            className="flex-1 sm:flex-initial justify-center"
            disabled={!can("delete", "notification")}
          >
            Xóa
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {notification.status === 'processing' && (
          <div className="lg:col-span-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
            <div className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight">Đang gửi thông báo</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Hệ thống đang xử lý hàng đợi và gửi email ngầm</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-primary tracking-tighter">{overallProgressPct}%</span>
                </div>
              </div>

              <div className="relative mb-6">
                <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-1000 ease-out"
                    style={{ width: `${overallProgressPct}%` }}
                  />
                  {overallFailPct > 0 && (
                    <div
                      className="h-full bg-red-500 absolute top-0 left-0 transition-all duration-1000 opacity-40"
                      style={{ width: `${overallFailPct}%` }}
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-1">
                    <UserGroupIcon className="h-4 w-4 text-gray-400" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Tổng số</span>
                  </div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">{totalRecipients}</div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircleIcon className="h-4 w-4 text-green-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Đã gửi</span>
                  </div>
                  <div className="text-xl font-bold text-green-600">{sentCount}</div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-1">
                    <ExclamationCircleIcon className="h-4 w-4 text-red-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Lỗi</span>
                  </div>
                  <div className="text-xl font-bold text-red-600">{failedCount}</div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-1">
                    <ClockIcon className="h-4 w-4 text-primary" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Còn lại</span>
                  </div>
                  <div className="text-xl font-bold text-primary">{pendingCount}</div>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="lg:col-span-2 rounded-lg bg-white p-6 dark:bg-gray-800 space-y-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Loại: {notification.type === 'announcement' ? 'Thông báo chung' :
              notification.type === 'reminder' ? 'Nhắc nhở' :
                notification.type === 'payment' ? 'Học phí' :
                  notification.type === 'attendance' ? 'Điểm danh' :
                    notification.type === 'grade' ? 'Điểm số' :
                      notification.type === 'other' ? 'Khác' :
                        notification.type || 'general'}
            {' • '}
            Đối tượng: {notification.target === 'student' ? 'Học viên' :
              notification.target === 'tutor' ? 'Giáo viên' :
                notification.target === 'all' ? 'Tất cả' :
                  notification.target || 'Tất cả'}
            {notification.status !== 'processing' && (
              <>
                {' • '}
                Trạng thái: {notification.status === 'sent' ? 'Đã gửi' :
                  notification.status === 'scheduled' ? 'Đã lên lịch' :
                    notification.status === 'failed' ? 'Thất bại' :
                      notification.status === 'draft' ? 'Bản nháp' :
                        notification.status}
              </>
            )}
          </div>
          <div className="prose max-w-none text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {notification.content || notification.message}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Thông tin</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <CalendarIcon className="h-5 w-5 text-gray-400" />
                <span>Ngày tạo: {new Date(notification.created_at).toLocaleString('vi-VN')}</span>
              </div>
              {notification.scheduled_at && (
                <div className="flex items-center gap-3">
                  <CalendarIcon className="h-5 w-5 text-gray-400" />
                  <span>Lên lịch: {new Date(notification.scheduled_at).toLocaleString('vi-VN')}</span>
                </div>
              )}
              {notification.sent_at && (
                <div className="flex items-center gap-3">
                  <CalendarIcon className="h-5 w-5 text-gray-400" />
                  <span>Đã gửi: {new Date(notification.sent_at).toLocaleString('vi-VN')}</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <span>Kênh: {notification.channel === 'email' ? 'Email' :
                  notification.channel === 'zalo' ? 'Zalo' :
                    notification.channel === 'sms' ? 'SMS' :
                      notification.channel === 'in_app' ? 'Trong ứng dụng' :
                        notification.channel || 'N/A'}</span>
              </div>

              {/* Recipient Classes Names */}
              {notification.recipient_classes && notification.recipient_classes.length > 0 && (
                <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                  <span className="font-semibold block mb-1">Lớp nhận tin:</span>
                  <div className="flex flex-wrap gap-1">
                    {notification.recipient_classes.map((cid: string) => {
                      const cls = classes?.find((c: any) => idsEqual(getObjId(c), cid));
                      return (
                        <span key={cid} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                          {cls?.name || cid}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}


              {notification.failed_count !== undefined && notification.failed_count > 0 && (
                <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
                  <span>Thất bại: {notification.failed_count}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {isEmailChannel && (
        <div className="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5 space-y-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Gửi email theo đợt</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Chia nhỏ người nhận để tránh quá tải. Mặc định 50 người/đợt.
              </p>
              {!isEmailChannel && (
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                  Chỉ áp dụng cho thông báo kênh Email. Hiện kênh: {notification.channel || 'N/A'}.
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                icon={<PaperAirplaneIcon className="h-4 w-4" />}
                loading={sendingBatch}
                disabled={!isEmailChannel || notification.status === 'processing' || selectedKeys.size === 0}
                onClick={async () => {
                  const res = await sendEmailBatch(notificationId, {
                    ...(selectedUserIds.length > 0 && { recipient_ids: selectedUserIds }),
                    ...(selectedStudentIds.length > 0 && { recipient_student_ids: selectedStudentIds }),
                  });
                  const payload = (res as any)?.data ?? res;
                  if (payload) {
                    setBatchProgress({
                      processed: Number(payload.processed ?? 0),
                      total_in_batch: Number(payload.total_in_batch ?? 0),
                      sent_batch: Number(payload.sent_batch ?? 0),
                      failed_batch: Number(payload.failed_batch ?? 0),
                      pending_left: Number(payload.pending_left ?? 0),
                    });
                  }
                  refetchNotification?.();
                  refetchRecipients?.();
                }}
              >
                Gửi đợt mới
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={<ArrowPathIcon className="h-4 w-4" />}
                loading={resendingFailed}
                disabled={!isEmailChannel || notification.status === 'processing' || selectedKeys.size === 0}
                onClick={async () => {
                  const res = await resendFailed(notificationId, { batch_size: 50 });
                  const payload = (res as any)?.data ?? res;
                  if (payload) {
                    setBatchProgress({
                      processed: Number(payload.processed ?? 0),
                      total_in_batch: Number(payload.total_in_batch ?? 0),
                      sent_batch: Number(payload.sent_batch ?? 0),
                      failed_batch: Number(payload.failed_batch ?? 0),
                      pending_left: Number(payload.pending_left ?? 0),
                    });
                  }
                  refetchNotification?.();
                  refetchRecipients?.();
                }}
              >
                Gửi lại bản lỗi
              </Button>
            </div>
          </div>

          {batchTotal > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span>Tiến độ đợt gần nhất</span>
                <span className="font-semibold">
                  {batchProcessed}/{batchTotal}
                </span>
                {batchPendingLeft > 0 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Còn lại: {batchPendingLeft}
                  </span>
                )}
              </div>
              <div className="h-3 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${batchProgressPct}%` }}
                />
                {batchFailPct > 0 && (
                  <div
                    className="h-full bg-red-500/80 -mt-3 opacity-80 transition-all duration-500"
                    style={{ width: `${batchFailPct}%` }}
                  />
                )}
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span>Đã gửi: {batchSent}</span>
                <span className="text-red-500">Lỗi: {batchFailed}</span>
              </div>
            </div>
          )}
        </div>
      )}
      {isEmailChannel && notification.status !== 'processing' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-700 dark:text-gray-300">
          <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
                <CheckCircleIcon className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider leading-none mb-1">Đã gửi</div>
                <div className="text-xl font-black">{sentCount}</div>
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
                <ExclamationCircleIcon className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider leading-none mb-1">Lỗi</div>
                <div className="text-xl font-black text-red-600 dark:text-red-400">
                  {failedCount}
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/5 dark:bg-primary/20">
                <ClockIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider leading-none mb-1">Chờ gửi</div>
                <div className="text-xl font-black">
                  {pendingCount}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isEmailChannel && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <SelectInput
              label="Lọc theo trạng thái"
              name="recipient_status"
              value={recipientStatusFilter}
              handleChange={(e) => {
                setRecipientStatusFilter(e.target.value as 'all' | 'pending' | 'sent' | 'failed' | 'skipped');
                setCurrentPage(1);
              }}
              options={[
                { label: "Tất cả", value: "all" },
                { label: "Chờ gửi", value: "pending" },
                { label: "Đã gửi", value: "sent" },
                { label: "Thất bại", value: "failed" },
                { label: "Bỏ qua", value: "skipped" },
              ]}
            />
            <InputGroup
              type="number"
              label="Số người nhận/trang"
              name="per_page"
              value={String(perPage)}
              handleChange={(e) => {
                const val = Number(e.target.value) || 50;
                setPerPage(Math.min(Math.max(val, 10), 200));
                setCurrentPage(1);
              }}
              min={10}
              max={200}
            />
          </div>

          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-800/70 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span>Danh sách người nhận</span>
                {selectedKeys.size > 0 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Đã chọn {selectedKeys.size} người nhận
                  </span>
                )}
              </div>
              {recipientsLoading && (
                <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  Đang tải...
                </span>
              )}
            </div>
            {recipientsError && (
              <div className="p-4 text-sm text-red-600 dark:text-red-400">
                Không tải được danh sách người nhận
              </div>
            )}
            {!recipientsLoading && !recipientsError && recipients.length === 0 && (
              <div className="p-4 text-sm text-gray-600 dark:text-gray-300 italic">
                {notification.status === 'scheduled' || notification.status === 'draft' ? (
                  <span>Người nhận sẽ được tạo tự động khi thông báo được gửi (Dựa trên lớp/học viên bạn đã chọn).</span>
                ) : (
                  <span>Chưa có người nhận nào.</span>
                )}
              </div>
            )}
            {!recipientsLoading && !recipientsError && recipients.length > 0 && (
              <>
                <div className="hidden lg:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300 w-12">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            checked={
                              recipients.length > 0 &&
                              recipients.filter((item: any) => item.email_verified).length > 0 &&
                              recipients.filter((item: any) => item.email_verified).every((item: any) => selectedKeys.has(buildKey(item)))
                            }
                            onChange={(e) => selectPage(e.target.checked)}
                          />
                        </th>
                        <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Người nhận</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Trạng thái</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Lần gửi</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Lỗi</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Thời gian</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {recipients.map((item: any) => (
                        <tr key={getObjId(item) || `${item.user_id || ''}-${item.student_id || ''}`}>
                          <td className="px-4 py-2">
                            <input
                              type="checkbox"
                              className={`h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary ${!item.email_verified ? 'opacity-50 cursor-not-allowed' : ''}`}
                              checked={selectedKeys.has(buildKey(item))}
                              onChange={() => toggleSelect(item)}
                              disabled={!item.email_verified}
                            />
                          </td>
                          <td className="px-4 py-2 text-gray-900 dark:text-gray-100">
                            <UserInfoBox
                              name={item.student_name || item.user_name || item.name || item.full_name || 'Không rõ'}
                              email={item.email || 'Không có email'}
                              emailVerified={item.email_verified || false}
                              avatar={item.avatar}
                              phone={item.phone}
                              role={item.role}
                              showRole={!!item.role_label}
                              studentCode={item.student_code || item.code}
                              size="sm"
                              layout="horizontal"
                            />
                          </td>

                          <td className="px-4 py-2">
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${item.status === 'sent'
                                ? 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]'
                                : item.status === 'pending'
                                  ? 'bg-[var(--status-badge-pending)] text-[var(--status-badge-pending-text)]'
                                  : item.status === 'skipped'
                                    ? 'bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]'
                                    : 'bg-[var(--status-badge-error)] text-[var(--status-badge-error-text)]'
                                }`}
                            >
                              {item.status === 'sent' ? 'Đã gửi' : item.status === 'pending' ? 'Chờ gửi' : item.status === 'skipped' ? 'Bỏ qua' : 'Lỗi'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-gray-700 dark:text-gray-200">{item.attempt ?? '—'}</td>
                          <td className="px-4 py-2 text-gray-700 dark:text-gray-200">
                            {item.error_message ? (
                              <span className="text-red-500">{item.error_message}</span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-4 py-2 text-gray-700 dark:text-gray-200">
                            {item.sent_at ? new Date(item.sent_at).toLocaleString('vi-VN') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="lg:hidden divide-y divide-gray-200 dark:divide-gray-700">
                  {recipients.map((item: any) => (
                    <div
                      key={getObjId(item) || `${item.user_id || ''}-${item.student_id || ''}`}
                      className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200 space-y-2"
                    >
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className={`h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary ${!item.email_verified ? 'opacity-50 cursor-not-allowed' : ''}`}
                          checked={selectedKeys.has(buildKey(item))}
                          onChange={() => toggleSelect(item)}
                          disabled={!item.email_verified}
                        />
                        <div className="flex-1 min-w-0">
                          <UserInfoBox
                            name={item.student_name || item.user_name || item.name || item.full_name || 'Không rõ'}
                            email={item.email || 'Không có email'}
                            emailVerified={item.email_verified || false}
                            avatar={item.avatar}
                            phone={item.phone}
                            role={item.role}
                            showRole={!!item.role_label}
                            studentCode={item.student_code || item.code}
                            size="sm"
                            layout="horizontal"
                          />
                        </div>
                      </label>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full font-semibold ${item.status === 'sent'
                            ? 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]'
                            : item.status === 'pending'
                              ? 'bg-[var(--status-badge-pending)] text-[var(--status-badge-pending-text)]'
                              : item.status === 'skipped'
                                ? 'bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]'
                                : 'bg-[var(--status-badge-error)] text-[var(--status-badge-error-text)]'
                            }`}
                        >
                          {item.status === 'sent' ? 'Đã gửi' : item.status === 'pending' ? 'Chờ gửi' : item.status === 'skipped' ? 'Bỏ qua' : 'Lỗi'}
                        </span>
                        {item.attempt !== undefined && <span>Lần gửi: {item.attempt}</span>}
                        {item.error_message && <span className="text-red-500">Lỗi: {item.error_message}</span>}
                        {item.sent_at && (
                          <span className="text-gray-500">
                            Gửi: {new Date(item.sent_at).toLocaleString('vi-VN')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Pagination */}
            {!recipientsLoading && !recipientsError && recipients.length > 0 && (
              <div className="border-t border-gray-200 dark:border-gray-700">
                <Pagination
                  meta={recipientsMeta}
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                  itemLabel="người nhận"
                  className="border-0 shadow-none"
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>

  );
}
