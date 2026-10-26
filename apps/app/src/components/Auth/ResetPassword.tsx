"use client";

import React, { useState } from "react";
import Link from "next/link";
import InputGroup from "../FormElements/InputGroup";
import apiClient from "@/lib/api-client";
import type { ApiResponse } from "@/lib/api-config";
import { useLockContext } from "@/contexts/lock-context";

interface ResetPasswordProps {
  initialEmail?: string;
  initialCode?: string;
}

export default function ResetPassword({ initialEmail, initialCode }: ResetPasswordProps) {
  const [email] = useState(initialEmail ?? "");
  const [code] = useState(initialCode ?? "");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lockContext = useLockContext();

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

    if (!password || password.length < 8) {
      setError("Mật khẩu phải có ít nhất 8 ký tự.");
      setLoading(false);
      return;
    }

    if (password !== passwordConfirmation) {
      setError("Mật khẩu xác nhận không khớp.");
      setLoading(false);
      return;
    }

    try {
      const response: ApiResponse = await apiClient.resetPassword({
        email: email.trim(),
        code: code.trim(),
        new_password: password,
        new_password_confirmation: passwordConfirmation,
      });

      if (response.success) {
        setSuccess(true);
        return;
      }

      // Nếu tài khoản bị khóa/vô hiệu -> dùng popup lock chung
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
        setError(response.message || "Mã xác nhận không hợp lệ hoặc đã hết hạn.");
        return;
      }

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

      setError(response.message || "Không thể đặt lại mật khẩu. Vui lòng thử lại.");
    } catch (_err) {
      setError("Không thể kết nối đến máy chủ. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success text-white">
            <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>

        <h2 className="mb-4 text-2xl font-bold text-dark dark:text-white">
          Đặt lại mật khẩu thành công
        </h2>

        <p className="mb-6 text-dark-4 dark:text-dark-6">
          Bạn có thể sử dụng mật khẩu mới để đăng nhập vào hệ thống.
        </p>

        <Link
          href="/auth/sign-in"
          className="flex w-full items-center justify-center rounded-lg bg-primary p-4 font-medium text-white transition hover:bg-opacity-90"
        >
          Đăng nhập
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="mb-6 text-center">
        <h2 className="mb-2 text-2xl font-bold text-dark dark:text-white">
          Đặt lại mật khẩu
        </h2>
        <p className="text-dark-4 dark:text-dark-6">
          Nhập mật khẩu mới để hoàn tất quá trình đặt lại mật khẩu.
        </p>
        {email && (
          <p className="mt-2 text-sm text-dark-4 dark:text-dark-6">
            Email: <strong>{email}</strong>
          </p>
        )}
      </div>

      {/* Hidden fields để gửi lên API */}
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="code" value={code} />

      <InputGroup
        type="password"
        label="Mật khẩu mới"
        className="mb-4 [&_input]:py-[15px]"
        placeholder="Nhập mật khẩu mới"
        name="password"
        handleChange={(e) => {
          setPassword(e.target.value);
          if (error) setError(null);
        }}
        value={password}
        required
      />

      <InputGroup
        type="password"
        label="Xác nhận mật khẩu mới"
        className="mb-6 [&_input]:py-[15px]"
        placeholder="Nhập lại mật khẩu mới"
        name="password_confirmation"
        handleChange={(e) => {
          setPasswordConfirmation(e.target.value);
          if (error) setError(null);
        }}
        value={passwordConfirmation}
        required
      />

      <div className="mb-4.5">
        <button
          type="submit"
          disabled={loading}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary p-4 font-medium text-white transition hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Đang đặt lại mật khẩu..." : "Đặt lại mật khẩu"}
          {loading && (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-t-transparent dark:border-primary dark:border-t-transparent" />
          )}
        </button>
      </div>


    </form>
  );
}


