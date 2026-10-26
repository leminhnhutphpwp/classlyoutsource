"use client";

import { useState, useEffect } from "react";
import { useSecuritySettings, useSendVerificationEmail, useVerifyEmail } from "@/hooks/use-api";
import { useNotification } from "@/hooks/use-notification";
import { useAuthContext } from "@/contexts/auth-context";
import OTPInput from "./OTPInput";
import Button from "@/components/Common/Button";
import {
  CheckCircleIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useLockContext } from "@/contexts/lock-context";

interface EmailVerificationProps {
  /** Trigger hiển thị form xác thực (ví dụ sau khi đổi email thành công) */
  showVerificationForm?: boolean;
  /** Callback khi email đã được verified hoặc form được đóng */
  onShowForm?: () => void;
  /** Email hiển thị để xác thực (ưu tiên hiển thị nếu được truyền vào) */
  email?: string;
}

export function EmailVerification({ showVerificationForm: externalShowForm, onShowForm, email }: EmailVerificationProps = {}) {
  const { data: securityData, loading: checkingStatus, refetch: refetchStatus } = useSecuritySettings();
  const { mutate: sendCode, loading: sendingCode } = useSendVerificationEmail();
  const { mutate: verifyCode, loading: verifyingCode } = useVerifyEmail();
  const { success, error: showError } = useNotification();
  const { actionsLocked } = useLockContext();
  const { user, refetchUser } = useAuthContext();

  // Ưu tiên hiển thị email được truyền vào (từ form đổi email), sau đó đến pending_email từ user, rồi đến email chính
  const userEmail = email || user?.pending_email || user?.email || "";

  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [showVerificationForm, setShowVerificationForm] = useState(false);

  // Update email verified status from API response
  useEffect(() => {
    if (securityData) {
      const verified = securityData.email_verified ?? false;
      setEmailVerified(verified);
      // Nếu email đã verified, ẩn form và notify parent
      // TUY NHIÊN: Nếu đang có external trigger (externalShowForm = true),
      // tức là parent đang muốn show form (ví dụ vừa đổi email xong, data cũ vẫn là verified),
      // thì KHÔNG ĐƯỢC ẩn form.
      if (verified && !externalShowForm) {
        setShowVerificationForm(false);
        // Notify parent để reset external trigger
        onShowForm?.();
      }
    }
  }, [securityData, onShowForm, externalShowForm]);

  // Xử lý external trigger để hiển thị form (ví dụ sau khi đổi email thành công)
  // Khi externalShowForm = true, force hiển thị form ngay lập tức
  // Vì sau khi đổi email, email mới chưa được verify, nên cần hiển thị form để user nhập mã
  useEffect(() => {
    if (externalShowForm) {
      // Force hiển thị form khi có external trigger (sau khi đổi email)
      // Không cần kiểm tra emailVerified vì sau khi đổi email, email mới chưa được verify
      setShowVerificationForm(true);
      // Refetch security settings để cập nhật trạng thái email_verified
      refetchStatus();
    }
  }, [externalShowForm, refetchStatus]);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  /**
   * Gửi mã xác thực email
   * 
   * Flow:
   * 1. Gọi API send-verification-email
   * 2. Response có expires_in (phút) và next_step: "verify_email"
   * 3. Hiển thị form nhập mã và bắt đầu countdown
   */
  const handleSendCode = async () => {
    try {
      const result = await sendCode();
      if (result.success) {
        // Sử dụng expires_in từ response (phút), mặc định 15 phút nếu không có
        const expiresInMinutes = result.data?.expires_in || 15;
        const expiresInSeconds = expiresInMinutes * 60;

        success("Mã xác thực đã được gửi đến email của bạn");
        // Start countdown dựa trên expires_in từ response
        setCountdown(expiresInSeconds);
        setCode(""); // Reset code input

        // Kiểm tra next_step để đảm bảo flow đúng
        // next_step: "verify_email" - Client cần gọi verify-email API
        if (result.data?.next_step === "verify_email") {
          // Hiển thị form nhập mã sau khi gửi mã thành công
          setShowVerificationForm(true);
          // Notify parent if needed
          onShowForm?.();
        }
      } else {
        showError(result.message || "Không thể gửi mã xác thực");
      }
    } catch (err: any) {
      showError(err.message || "Không thể gửi mã xác thực. Vui lòng thử lại.");
    }
  };

  /**
   * Xác thực email với mã code
   * 
   * Flow:
   * 1. User nhập mã 6 số từ email
   * 2. Gọi API verify-email với mã code
   * 3. Response có email_verified: true và user object với email_verified_at
   * 4. Cập nhật UI và ẩn form
   */
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    if (code.length !== 6) {
      showError("Vui lòng nhập đầy đủ 6 số");
      return;
    }

    try {
      const result = await verifyCode(code);
      if (result.success) {
        // Kiểm tra email_verified từ response
        const isVerified = result.data?.email_verified === true;

        if (isVerified) {
          success("Xác thực email thành công!");
          setCode("");
          setEmailVerified(true);
          setShowVerificationForm(false);
          // Notify parent để reset external trigger
          onShowForm?.();
          // Refetch security settings to update status
          refetchStatus();
          // Cập nhật thông tin user toàn cục (quan trọng để update email trong header, profile...)
          await refetchUser();
        } else {
          // Nếu response không có email_verified: true, vẫn coi như thành công
          // (backward compatibility)
          success("Xác thực email thành công!");
          setCode("");
          setEmailVerified(true);
          setShowVerificationForm(false);
          onShowForm?.();
          refetchStatus();
          // Cập nhật thông tin user toàn cục
          await refetchUser();
        }
      } else {
        showError(result.message || "Mã xác thực không hợp lệ");
        setCode(""); // Clear code on error
      }
    } catch (err: any) {
      showError(err.message || "Không thể xác thực email. Vui lòng thử lại.");
      setCode(""); // Clear code on error
    }
  };

  // Loading state
  if (checkingStatus && emailVerified === null) {
    return null; // Không hiển thị gì khi đang loading
  }

  // Email already verified - chỉ hiển thị badge nhỏ
  // NHƯNG nếu đang hiển thị form (do user request hoặc vừa đổi email), thì vẫn hiện form
  if (emailVerified === true && !showVerificationForm) {
    return (
      <div className="rounded-lg bg-white p-4 dark:bg-gray-800">
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
          <CheckCircleIcon className="h-5 w-5" />
          <span className="text-sm font-medium">Email đã được xác thực</span>
        </div>
      </div>
    );
  }

  // Email not verified
  // Nếu chưa hiển thị form, chỉ hiển thị banner đơn giản với nút gửi mã
  if (!showVerificationForm) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-gradient-to-r from-yellow-50 to-amber-50 p-5 dark:border-yellow-800 dark:from-yellow-900/20 dark:to-amber-900/20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="flex-shrink-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30">
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-yellow-900 dark:text-yellow-200">
                Email chưa được xác thực
              </h3>
              <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-400">
                Vui lòng xác thực email của bạn để bảo mật tài khoản.
              </p>
              {userEmail && (
                <div className="mt-2 flex items-center gap-2 rounded-md bg-white/60 px-2 py-1.5 dark:bg-gray-800/60">
                  <EnvelopeIcon className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                  <span className="text-xs font-medium text-yellow-900 dark:text-yellow-200 truncate">
                    {userEmail}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex-shrink-0 w-full sm:w-auto">
            <Button
              className="w-full sm:w-auto justify-center"
              type="button"
              onClick={handleSendCode}
              disabled={sendingCode || countdown > 0 || actionsLocked}
              loading={sendingCode}
              size="sm"
              variant="primary"
              icon={<EnvelopeIcon />}
            >
              {countdown > 0
                ? `${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, "0")}`
                : "Gửi mã xác thực"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Hiển thị form nhập mã khi đã gửi mã hoặc được trigger từ bên ngoài
  return (
    <div className="relative rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      {/* Nút đóng ở góc trên bên phải */}
      <button
        type="button"
        onClick={() => {
          setShowVerificationForm(false);
          onShowForm?.();
        }}
        className="absolute right-4 top-4 rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
        aria-label="Đóng"
      >
        <XMarkIcon className="h-5 w-5" />
      </button>

      <div className="mb-6 flex items-start gap-4 pr-8">
        <div className="flex-shrink-0">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30">
            <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
          </div>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Xác thực email
          </h3>
          <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">
            Mã xác thực 6 số đã được gửi đến email của bạn. Vui lòng nhập mã để hoàn tất xác thực.
          </p>
          {userEmail && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 dark:bg-blue-900/20">
              <EnvelopeIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-900 dark:text-blue-200">
                {userEmail}
              </span>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleVerify} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Mã xác thực (6 số)
          </label>
          <OTPInput
            length={6}
            value={code}
            onChange={setCode}
            disabled={verifyingCode || actionsLocked}
            className="justify-start"
          />
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Nhập mã 6 số đã được gửi đến email của bạn
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="submit"
            disabled={verifyingCode || code.length !== 6 || actionsLocked}
            loading={verifyingCode}
            size="sm"
            variant="primary"
            icon={<CheckCircleIcon />}
            className="flex-1"
          >
            Xác thực
          </Button>

          <Button
            type="button"
            onClick={handleSendCode}
            disabled={sendingCode || countdown > 0 || actionsLocked}
            loading={sendingCode}
            size="sm"
            variant="outline"
            icon={<EnvelopeIcon />}
            className="flex-1"
          >
            {countdown > 0
              ? `Gửi lại (${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, "0")})`
              : "Gửi lại mã"}
          </Button>
        </div>

        {countdown > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Mã xác thực có hiệu lực trong {Math.floor(countdown / 60)} phút {countdown % 60} giây
          </p>
        )}
      </form>
    </div>
  );
}

