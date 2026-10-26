"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { EmailIcon } from "@/assets/icons";
import InputGroup from "../FormElements/InputGroup";
import OTPInput from "./OTPInput";
import apiClient from "@/lib/api-client";
import type { ApiResponse } from "@/lib/api-config";
import { useLockContext } from "@/contexts/lock-context";

interface VerifyCodeProps {
  initialEmail: string;
}

export default function VerifyCode({ initialEmail }: VerifyCodeProps) {
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lockContext = useLockContext();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validation
    if (!email || !email.trim()) {
      setError("Vui lòng nhập địa chỉ email.");
      setLoading(false);
      return;
    }

    if (!code || code.trim().length !== 6 || !/^\d{6}$/.test(code.trim())) {
      setError("Mã xác nhận phải là 6 chữ số.");
      setLoading(false);
      return;
    }

    try {
      const response: ApiResponse = await apiClient.verifyResetCode(
        email.trim(),
        code.trim()
      );

      if (response.success) {
        // Verify thành công → chuyển sang trang reset password với email và code
        router.push(
          `/auth/reset-password?email=${encodeURIComponent(email.trim())}&code=${encodeURIComponent(code.trim())}`
        );
        return;
      }

      // Nếu backend trả trạng thái khóa → dùng popup lock global
      if (
        response.code === "ACCOUNT_LOCKED" ||
        response.code === "ACCOUNT_INACTIVE" ||
        response.code === "ACCOUNT_ACTIONS_LOCKED" ||
        response.code === "TUTOR_INACTIVE"
      ) {
        lockContext.setActionLockFromResponse(response);
        return;
      }

      if (response.code === "INVALID_CODE") {
        setError(
          response.message ||
          "Mã xác nhận không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra lại."
        );
        return;
      }

      // Validation errors
      if (response.errors) {
        const messages: string[] = [];
        Object.values(response.errors).forEach((arr) => {
          if (Array.isArray(arr) && arr.length > 0) {
            messages.push(arr[0]);
          }
        });
        if (messages.length > 0) {
          setError(messages.join(" "));
          return;
        }
      }

      setError(
        response.message ||
        "Không thể xác thực mã. Vui lòng thử lại."
      );
    } catch {
      setError("Không thể kết nối đến máy chủ. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      <InputGroup
        type="email"
        label="Địa chỉ Email"
        className="mb-4 [&_input]:py-[15px]"
        placeholder="Nhập địa chỉ email của bạn"
        name="email"
        handleChange={(e) => {
          setEmail(e.target.value);
          if (error) setError(null);
        }}
        value={email}
        icon={<EmailIcon />}
        required
        disabled={!!initialEmail}
      />

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 text-center">
          Mã xác nhận
        </label>
        <OTPInput
          length={6}
          value={code}
          onChange={(value) => {
            setCode(value);
            if (error) setError(null);
          }}
          disabled={loading}
        />
      </div>

      <div className="mb-4.5">
        <button
          type="submit"
          disabled={loading}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary p-4 font-medium text-white transition hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Đang xác thực..." : "Xác nhận mã"}
          {loading && (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-t-transparent dark:border-primary dark:border-t-transparent" />
          )}
        </button>
      </div>

      <div className="mt-6 text-center">
        <p className="text-sm text-dark-4 dark:text-dark-6">
          Chưa nhận được mã?{" "}
          <button
            type="button"
            onClick={() => router.push("/auth/forgot-password")}
            className="font-medium text-primary hover:text-primary-600 transition-colors"
          >
            Gửi lại mã
          </button>
        </p>
      </div>
    </form>
  );
}

