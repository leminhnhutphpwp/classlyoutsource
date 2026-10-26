"use client";

import { useEffect, useState, useCallback } from "react";
import { QRCodeCanvas } from "qrcode.react";
import {
  ShieldCheckIcon,
  ShieldExclamationIcon,
  CheckCircleIcon,
  ClipboardDocumentIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";
import InputGroup from "@/components/FormElements/InputGroup";
import Button from "@/components/Common/Button";
import { apiClient } from "@/lib/api-client";
import { useNotification } from "@/hooks/use-notification";
import { useAuthContext } from "@/contexts/auth-context";

type Phase = "loading" | "disabled" | "enrolling" | "confirming" | "recovery" | "enabled";

/**
 * Two-factor (TOTP) settings panel. Drives the full enable flow — password re-entry →
 * provisioning QR (via qrcode.react, CSP-safe canvas) + manual secret → 6-digit confirm →
 * one-time recovery codes — and a disable action. All calls go through same-origin /api/* .
 */
export default function TwoFactorSettings() {
  const { success, error: showError } = useNotification();
  const { refetchUser } = useAuthContext();

  const [phase, setPhase] = useState<Phase>("loading");
  const [submitting, setSubmitting] = useState(false);

  // Enable flow state
  const [password, setPassword] = useState("");
  const [provisioningUri, setProvisioningUri] = useState("");
  const [secret, setSecret] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  // Disable flow state
  const [showDisable, setShowDisable] = useState(false);
  const [disableCode, setDisableCode] = useState("");

  const loadStatus = useCallback(async () => {
    try {
      const res = await apiClient.getSecuritySettings();
      const enabled = res.success && (res.data as any)?.two_factor_enabled === true;
      setPhase(enabled ? "enabled" : "disabled");
    } catch {
      setPhase("disabled");
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const resetEnableState = () => {
    setPassword("");
    setProvisioningUri("");
    setSecret("");
    setConfirmCode("");
  };

  const handleStartEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!password) {
      showError("Vui lòng nhập mật khẩu hiện tại");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiClient.enableTwoFactor(password);
      if (res.success) {
        const d = res.data as any;
        setProvisioningUri(d.provisioning_uri);
        setSecret(d.secret);
        setPhase("confirming");
      } else {
        showError(res.message || "Không thể bắt đầu thiết lập xác thực hai lớp");
      }
    } catch {
      showError("Đã xảy ra lỗi. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (confirmCode.trim().length < 6) {
      showError("Vui lòng nhập mã 6 số từ ứng dụng xác thực");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiClient.confirmTwoFactor(confirmCode.trim());
      if (res.success) {
        setRecoveryCodes((res.data as any)?.recovery_codes || []);
        setPhase("recovery");
        resetEnableState();
        await refetchUser();
        success("Đã bật xác thực hai lớp");
      } else {
        showError(res.message || "Mã xác thực không đúng");
      }
    } catch {
      showError("Đã xảy ra lỗi. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!disableCode.trim()) {
      showError("Nhập mã xác thực hoặc mã khôi phục để tắt");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiClient.disableTwoFactor({ code: disableCode.trim() });
      if (res.success) {
        setShowDisable(false);
        setDisableCode("");
        setPhase("disabled");
        await refetchUser();
        success("Đã tắt xác thực hai lớp");
      } else {
        showError(res.message || "Không thể tắt xác thực hai lớp");
      }
    } catch {
      showError("Đã xảy ra lỗi. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyRecoveryCodes = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCodes.join("\n"));
      success("Đã sao chép mã khôi phục");
    } catch {
      showError("Không thể sao chép");
    }
  };

  const downloadRecoveryCodes = () => {
    const blob = new Blob([recoveryCodes.join("\n") + "\n"], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "classly-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (phase === "loading") {
    return (
      <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
        <div className="h-6 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
      <div className="mb-4 flex items-center gap-2">
        {phase === "enabled" ? (
          <ShieldCheckIcon className="h-6 w-6 text-green-500" />
        ) : (
          <ShieldExclamationIcon className="h-6 w-6 text-yellow-500" />
        )}
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Xác thực hai lớp (2FA)
        </h3>
      </div>

      {/* DISABLED — start enable flow */}
      {phase === "disabled" && (
        <form onSubmit={handleStartEnable} className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Tăng cường bảo mật bằng mã dùng một lần từ ứng dụng xác thực (Google Authenticator, Authy...).
            Nhập mật khẩu hiện tại để bắt đầu.
          </p>
          <InputGroup
            type="password"
            label="Mật khẩu hiện tại"
            placeholder="Nhập mật khẩu để xác thực"
            name="tfa_password"
            value={password}
            handleChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" disabled={submitting} loading={submitting} size="sm" variant="primary" icon={<ShieldCheckIcon />}>
            Bật xác thực hai lớp
          </Button>
        </form>
      )}

      {/* CONFIRMING — show QR + secret, ask for code */}
      {phase === "confirming" && (
        <form onSubmit={handleConfirm} className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Quét mã QR bằng ứng dụng xác thực, sau đó nhập mã 6 số để hoàn tất.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700">
              {provisioningUri && <QRCodeCanvas value={provisioningUri} size={176} includeMargin />}
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">Hoặc nhập mã thủ công:</p>
              <code className="mt-1 block break-all rounded bg-gray-100 px-2 py-1 text-sm text-gray-800 dark:bg-gray-900 dark:text-gray-200">
                {secret}
              </code>
            </div>
          </div>
          <InputGroup
            type="text"
            label="Mã xác thực (6 số)"
            placeholder="123456"
            name="tfa_confirm_code"
            value={confirmCode}
            handleChange={(e) => setConfirmCode(e.target.value)}
            required
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={submitting} loading={submitting} size="sm" variant="primary" icon={<CheckCircleIcon />}>
              Xác nhận
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                resetEnableState();
                setPhase("disabled");
              }}
            >
              Hủy
            </Button>
          </div>
        </form>
      )}

      {/* RECOVERY — show one-time codes */}
      {phase === "recovery" && (
        <div className="space-y-4">
          <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300">
            Lưu các mã khôi phục này ở nơi an toàn. Mỗi mã dùng được một lần khi bạn không có
            ứng dụng xác thực. Bạn sẽ không thấy lại chúng.
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-4 dark:bg-gray-900">
            {recoveryCodes.map((code) => (
              <code key={code} className="text-center font-mono text-sm text-gray-800 dark:text-gray-200">
                {code}
              </code>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={copyRecoveryCodes} icon={<ClipboardDocumentIcon />}>
              Sao chép
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={downloadRecoveryCodes} icon={<ArrowDownTrayIcon />}>
              Tải xuống
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                setRecoveryCodes([]);
                setPhase("enabled");
              }}
              icon={<CheckCircleIcon />}
            >
              Tôi đã lưu, hoàn tất
            </Button>
          </div>
        </div>
      )}

      {/* ENABLED — status + disable */}
      {phase === "enabled" && (
        <div className="space-y-4">
          <p className="text-sm text-green-600 dark:text-green-400">
            Xác thực hai lớp đang <strong>bật</strong>. Mỗi lần đăng nhập bạn sẽ cần nhập mã từ ứng dụng xác thực.
          </p>
          {!showDisable ? (
            <Button type="button" variant="danger" size="sm" onClick={() => setShowDisable(true)}>
              Tắt xác thực hai lớp
            </Button>
          ) : (
            <form onSubmit={handleDisable} className="space-y-3">
              <InputGroup
                type="text"
                label="Mã xác thực hoặc mã khôi phục"
                placeholder="Nhập mã để xác nhận tắt"
                name="tfa_disable_code"
                value={disableCode}
                handleChange={(e) => setDisableCode(e.target.value)}
                required
              />
              <div className="flex gap-2">
                <Button type="submit" variant="danger" size="sm" disabled={submitting} loading={submitting}>
                  Xác nhận tắt
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setShowDisable(false);
                    setDisableCode("");
                  }}
                >
                  Hủy
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
