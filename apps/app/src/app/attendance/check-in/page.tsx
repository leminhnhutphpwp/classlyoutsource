"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCheckInAttendance } from "@/hooks/use-api";
import Button from "@/components/Common/Button";
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  QrCodeIcon,
} from "@heroicons/react/24/outline";

interface CheckInResult {
  status?: "present" | "late";
  already_checked_in?: boolean;
  class_name?: string;
  session_date?: string;
}

// Map backend error codes → friendly Vietnamese messages.
function mapErrorMessage(code?: string, fallback?: string): string {
  switch (code) {
    case "QR_EXPIRED":
      return "Mã QR đã hết hạn, nhờ thầy/cô làm mới.";
    case "INVALID_CODE":
      return "Mã điểm danh không đúng. Vui lòng kiểm tra lại.";
    case "STUDENT_PAUSED":
      return "Bạn đang tạm dừng lớp này nên chưa thể điểm danh.";
    case "NOT_FOUND":
      return "Không tìm thấy buổi học để điểm danh.";
    case "FORBIDDEN":
      return "Bạn không thuộc lớp này.";
    default:
      return fallback || "Không thể điểm danh. Vui lòng thử lại.";
  }
}

function formatSessionDate(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function CheckInContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const checkInMutation = useCheckInAttendance();

  const [result, setResult] = useState<CheckInResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [code, setCode] = useState("");

  const submit = async (body: { token?: string; code?: string }) => {
    setSubmitting(true);
    setErrorMessage(null);
    setResult(null);
    const res = await checkInMutation.mutate(body);
    if (res?.success) {
      setResult((res.data as CheckInResult) || {});
    } else {
      setErrorMessage(mapErrorMessage(res?.code, res?.message));
    }
    setSubmitting(false);
  };

  // Auto check-in when arriving from a scanned QR (?token=...).
  const autoRanRef = useRef(false);
  useEffect(() => {
    if (token && !autoRanRef.current) {
      autoRanRef.current = true;
      void submit({ token });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (trimmed.length < 4) {
      setErrorMessage("Vui lòng nhập mã điểm danh.");
      return;
    }
    void submit({ code: trimmed });
  };

  const isLate = result?.status === "late";

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="text-center">
        <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white">Điểm danh</h1>
        <p className="text-sm text-dark-4 dark:text-dark-6 mt-1">
          Quét mã QR của thầy/cô hoặc nhập mã điểm danh bên dưới
        </p>
      </div>

      {/* Auto check-in status while a token is being processed */}
      {token && submitting && !result && !errorMessage && (
        <div className="rounded-lg bg-white p-6 text-center dark:bg-gray-800">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">Đang điểm danh…</p>
        </div>
      )}

      {/* Success card */}
      {result && (
        <div className="rounded-lg bg-white p-6 dark:bg-gray-800 ring-1 ring-primary/10">
          <div className="flex flex-col items-center text-center">
            <div className="rounded-full bg-primary-pastel/60 p-3 dark:bg-primary-pastel/20">
              <CheckCircleIcon className="h-10 w-10 text-primary dark:text-primary-light" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">Đã điểm danh</h2>
            {(result.class_name || result.session_date) && (
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {[result.class_name, formatSessionDate(result.session_date)].filter(Boolean).join(" · ")}
              </p>
            )}
            {isLate && (
              <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-primary-pastel/60 px-3 py-1 text-xs font-medium text-primary-light dark:bg-primary-pastel/20 dark:text-primary-light">
                <ClockIcon className="h-4 w-4" />
                Đi muộn
              </span>
            )}
            {result.already_checked_in && (
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                Bạn đã điểm danh trước đó.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Error card */}
      {errorMessage && (
        <div className="rounded-lg bg-red-50 p-4 dark:bg-red-900/20 ring-1 ring-red-200/60 dark:ring-red-800/40">
          <div className="flex items-start gap-3">
            <XCircleIcon className="h-6 w-6 flex-shrink-0 text-red-600 dark:text-red-400" />
            <p className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Code-entry fallback (always available) */}
      <form onSubmit={handleCodeSubmit} className="rounded-lg bg-white p-6 dark:bg-gray-800">
        <div className="flex items-center gap-2 mb-4">
          <QrCodeIcon className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Nhập mã điểm danh</h2>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Nếu không quét được QR, nhập mã 6 số thầy/cô đang hiển thị trên màn hình.
        </p>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\s/g, "").toUpperCase())}
          placeholder="Nhập mã"
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-center text-2xl font-bold tracking-[0.3em] text-gray-900 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white placeholder:text-base placeholder:font-normal placeholder:tracking-normal placeholder:text-gray-400"
        />
        <Button
          type="submit"
          disabled={submitting || code.trim().length < 4}
          loading={submitting}
          size="md"
          icon={<CheckCircleIcon />}
          className="mt-4 w-full justify-center"
        >
          Điểm danh
        </Button>
      </form>
    </div>
  );
}

export default function AttendanceCheckInPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg">
          <div className="h-40 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
        </div>
      }
    >
      <CheckInContent />
    </Suspense>
  );
}
