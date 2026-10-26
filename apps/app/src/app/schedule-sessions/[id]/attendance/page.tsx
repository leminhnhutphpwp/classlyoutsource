"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import {
  useStartAttendanceQr,
  useAttendanceQrToken,
  useAttendanceLive,
} from "@/hooks/use-api";
import { useAuthContext } from "@/contexts/auth-context";
import { useAuthorization } from "@/lib/authz";
import { useNotification } from "@/hooks/use-notification";
import { getObjId } from "@/lib/id-utils";
import Button from "@/components/Common/Button";
import ButtonLink from "@/components/Common/ButtonLink";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  QrCodeIcon,
} from "@heroicons/react/24/outline";

// Poll intervals (ms) - live roster refreshes fast, QR token rotates slower.
const LIVE_POLL_MS = 5000;
const TOKEN_REFRESH_MS = 45000;
const TOKEN_REFRESH_SECONDS = TOKEN_REFRESH_MS / 1000;

interface QrData {
  token: string;
  code: string;
  check_in_url: string;
  expires_at?: string;
}

type LiveStatus = "present" | "late" | "absent";

interface LiveStudent {
  id: string | number;
  name: string;
  status: LiveStatus;
  checked_in_via?: string | null;
  check_in_time?: string | null;
}

const STATUS_META: Record<LiveStatus, { label: string; badgeClass: string }> = {
  present: {
    label: "Có mặt",
    badgeClass: "bg-primary-pastel text-primary dark:bg-primary-pastel/20 dark:text-primary-light",
  },
  late: {
    label: "Đi muộn",
    badgeClass: "bg-primary-pastel/60 text-primary-light dark:bg-primary-pastel/20 dark:text-primary-light",
  },
  absent: {
    label: "Vắng mặt",
    badgeClass: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
};

function formatCheckInTime(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

export default function AttendanceQrScreen() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const { loading: authLoading } = useAuthContext();
  const { can } = useAuthorization();
  const allowed = can("create", "attendance");
  const { error: showError } = useNotification();

  const startMutation = useStartAttendanceQr();
  const tokenMutation = useAttendanceQrToken();

  const [qr, setQr] = useState<QrData | null>(null);
  const [starting, setStarting] = useState(true);
  const [startError, setStartError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(TOKEN_REFRESH_SECONDS);

  // Live roster polling (network-only). Only enabled after QR session started.
  const ready = !!qr;
  const { data: live, refetch: refetchLive } = useAttendanceLive(sessionId, ready);

  const counts = (live?.counts as { total?: number; present?: number; late?: number; absent?: number }) || {};
  const students = (live?.students as LiveStudent[]) || [];

  // Redirect non-tutors once auth is resolved.
  useEffect(() => {
    if (!authLoading && !allowed) {
      router.replace("/403");
    }
  }, [authLoading, allowed, router]);

  const applyQr = useCallback((data: any) => {
    if (!data?.check_in_url || !data?.token) return;
    setQr({
      token: data.token,
      code: data.code,
      check_in_url: data.check_in_url,
      expires_at: data.expires_at,
    });
    setSecondsLeft(TOKEN_REFRESH_SECONDS);
  }, []);

  // Keep the latest token-refresh routine in a ref so the interval stays stable.
  const rotateTokenRef = useRef<() => void>(() => {});
  useEffect(() => {
    rotateTokenRef.current = async () => {
      const res = await tokenMutation.mutate(sessionId);
      if (res?.success) {
        applyQr(res.data);
      }
    };
  }, [tokenMutation, sessionId, applyQr]);

  // Start the QR attendance session on mount (sets the session ongoing).
  useEffect(() => {
    if (authLoading || !allowed || !sessionId) return;
    let cancelled = false;
    (async () => {
      setStarting(true);
      setStartError(null);
      const res = await startMutation.mutate(sessionId);
      if (cancelled) return;
      if (res?.success) {
        applyQr(res.data);
      } else {
        setStartError(res?.message || "Không thể bắt đầu phiên điểm danh");
        showError("Lỗi", res?.message || "Không thể bắt đầu phiên điểm danh");
      }
      setStarting(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, allowed, sessionId]);

  // Rotate the QR token every TOKEN_REFRESH_MS while a session is active.
  useEffect(() => {
    if (!ready) return;
    const id = setInterval(() => {
      rotateTokenRef.current();
    }, TOKEN_REFRESH_MS);
    return () => clearInterval(id);
  }, [ready]);

  // Countdown ticker for the "mã làm mới sau …s" hint.
  useEffect(() => {
    if (!ready) return;
    const id = setInterval(() => {
      setSecondsLeft((prev) => (prev <= 1 ? TOKEN_REFRESH_SECONDS : prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [ready]);

  // Poll the live roster every LIVE_POLL_MS.
  const refetchLiveRef = useRef(refetchLive);
  useEffect(() => {
    refetchLiveRef.current = refetchLive;
  }, [refetchLive]);
  useEffect(() => {
    if (!ready) return;
    const id = setInterval(() => {
      refetchLiveRef.current();
    }, LIVE_POLL_MS);
    return () => clearInterval(id);
  }, [ready]);

  if (!authLoading && !allowed) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            onClick={() => router.push(`/schedule-sessions/${sessionId}`)}
            variant="outline"
            size="sm"
            icon={<ArrowLeftIcon />}
            className="flex-shrink-0"
          >
            Quay lại
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white truncate">
              QR điểm danh
            </h1>
            <p className="text-sm text-dark-4 dark:text-dark-6 mt-0.5">
              Học viên quét mã QR hoặc nhập mã 6 số để điểm danh
            </p>
          </div>
        </div>

        <ButtonLink
          href={`/schedule-sessions/${sessionId}`}
          variant="danger"
          size="sm"
          icon={<XCircleIcon className="h-5 w-5" />}
          className="w-full sm:w-auto justify-center"
        >
          Kết thúc
        </ButtonLink>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* QR card */}
        <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
          <div className="flex items-center gap-2 mb-4">
            <QrCodeIcon className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Mã QR điểm danh</h2>
          </div>

          {starting ? (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="h-[240px] w-[240px] animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Đang tạo mã QR…</p>
            </div>
          ) : startError ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <XCircleIcon className="h-12 w-12 text-red-500 mb-3" />
              <p className="text-sm text-red-600 dark:text-red-400 mb-4">{startError}</p>
              <Button
                onClick={() => router.refresh()}
                variant="outline"
                size="sm"
                icon={<ArrowPathIcon />}
              >
                Thử lại
              </Button>
            </div>
          ) : qr ? (
            <div className="flex flex-col items-center">
              <div className="rounded-xl bg-white p-4 ring-1 ring-gray-200 dark:ring-gray-700">
                <QRCodeCanvas value={qr.check_in_url} size={240} includeMargin level="M" />
              </div>

              <div className="mt-5 w-full text-center">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Không quét được? Nhập mã này
                </p>
                <p className="mt-1 text-4xl font-bold tracking-[0.3em] text-primary dark:text-primary-light">
                  {qr.code}
                </p>
              </div>

              <div className="mt-4 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                <ArrowPathIcon className="h-4 w-4" />
                <span>Mã làm mới sau {secondsLeft}s</span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Live roster */}
        <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Danh sách điểm danh trực tiếp
          </h2>

          {/* Counter cards */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="rounded-lg bg-primary-pastel/40 dark:bg-primary-pastel/20 p-3 ring-1 ring-primary/10 dark:ring-primary/20">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-full bg-primary/20 dark:bg-primary/30">
                  <CheckCircleIcon className="h-4 w-4 text-primary dark:text-primary-light" />
                </div>
                <span className="text-xs font-medium text-primary dark:text-primary-light">Có mặt</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-primary dark:text-primary-light">{counts.present ?? 0}</p>
            </div>

            <div className="rounded-lg bg-primary-pastel/40 dark:bg-primary-pastel/20 p-3 ring-1 ring-primary/10 dark:ring-primary/20">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-full bg-primary/20 dark:bg-primary/30">
                  <ClockIcon className="h-4 w-4 text-primary-light dark:text-primary-light" />
                </div>
                <span className="text-xs font-medium text-primary-light dark:text-primary-light">Đi muộn</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-primary-light dark:text-primary-light">{counts.late ?? 0}</p>
            </div>

            <div className="rounded-lg bg-red-50 dark:bg-red-900/30 p-3 ring-1 ring-red-200/50 dark:ring-red-800/30">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-full bg-red-100 dark:bg-red-900/40">
                  <XCircleIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
                </div>
                <span className="text-xs font-medium text-red-800 dark:text-red-400">Vắng mặt</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-red-900 dark:text-red-300">{counts.absent ?? 0}</p>
            </div>
          </div>

          {/* Roster list */}
          {students.length > 0 ? (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {students.map((student) => {
                const meta = STATUS_META[student.status] ?? STATUS_META.absent;
                const time = formatCheckInTime(student.check_in_time);
                return (
                  <div
                    key={getObjId(student) || student.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 flex-shrink-0 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          {student.name?.charAt(0)?.toUpperCase() || "?"}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">{student.name}</p>
                        {time && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">Điểm danh lúc {time}</p>
                        )}
                      </div>
                    </div>
                    <span
                      className={`inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.badgeClass}`}
                    >
                      {meta.label}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-8 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Chưa có học viên nào điểm danh. Danh sách sẽ tự cập nhật.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
