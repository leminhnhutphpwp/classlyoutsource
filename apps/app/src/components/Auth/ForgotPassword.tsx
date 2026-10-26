"use client";
import Link from "next/link";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import InputGroup from "../FormElements/InputGroup";
import apiClient from "@/lib/api-client";
import type { ApiResponse } from "@/lib/api-config";
import { useLockContext } from "@/contexts/lock-context";
import { CheckCircleIcon } from "@heroicons/react/24/outline";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lockContext = useLockContext();
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response: ApiResponse = await apiClient.forgotPassword(email);

      if (response.success) {
        setSuccess(true);
        return;
      }

      // Nếu backend trả trạng thái khóa → dùng popup lock global thay vì chỉ lỗi cục bộ
      if (
        response.code === "ACCOUNT_LOCKED" ||
        response.code === "ACCOUNT_INACTIVE" ||
        response.code === "ACCOUNT_ACTIONS_LOCKED" ||
        response.code === "TUTOR_INACTIVE"
      ) {
        lockContext.setActionLockFromResponse(response);
        // Không cần set error nữa vì popup global sẽ hiển thị nội dung chi tiết
        return;
      }

      // Validation errors (email không tồn tại, format sai, v.v.)
      if (response.errors && response.errors.email && response.errors.email.length > 0) {
        setError(response.errors.email[0]);
        return;
      }

      setError(response.message || "Không thể gửi mã đặt lại. Vui lòng thử lại.");
    } catch {
      setError('Không thể gửi email đặt lại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success text-white">
            <CheckCircleIcon className="h-8 w-8" />
          </div>
        </div>

        <h2 className="mb-4 text-2xl font-bold text-dark dark:text-white">
          Kiểm tra Email của bạn
        </h2>

        <p className="mb-6 text-dark-4 dark:text-dark-6">
          Chúng tôi đã gửi <strong>mã xác nhận 6 số</strong> đến địa chỉ <strong>{email}</strong>.
          Vui lòng kiểm tra email và sử dụng mã này để đặt lại mật khẩu mới.
        </p>

        <div className="space-y-3">
          <button
            onClick={() => {
              router.push(`/auth/verify-code?email=${encodeURIComponent(email)}`);
            }}
            className="flex w-full items-center justify-center rounded-lg bg-primary p-4 font-medium text-white transition hover:bg-opacity-90"
          >
            Tiếp tục xác nhận mã
          </button>

          <div className="flex gap-3">
            <Link
              href="/auth/sign-in"
              className="flex-1 flex items-center justify-center rounded-lg border border-stroke p-4 font-medium text-dark transition hover:bg-gray-50 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
            >
              Quay lại Đăng nhập
            </Link>

            <button
              onClick={() => {
                setSuccess(false);
                setEmail("");
              }}
              className="flex-1 flex items-center justify-center rounded-lg border border-stroke p-4 font-medium text-dark transition hover:bg-gray-50 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
            >
              Thử Email khác
            </button>
          </div>
        </div>
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
          Quên mật khẩu?
        </h2>
        <p className="text-dark-4 dark:text-dark-6">
          Nhập địa chỉ email của bạn và chúng tôi sẽ gửi cho bạn liên kết để đặt lại mật khẩu.
        </p>
      </div>

      <InputGroup
        type="email"
        label="Địa chỉ Email"
        className="mb-6 [&_input]:py-[15px]"
        placeholder="Nhập địa chỉ email của bạn"
        name="email"
        handleChange={handleChange}
        value={email}
        required
      />

      <div className="mb-4.5">
        <button
          type="submit"
          disabled={loading}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary p-4 font-medium text-white transition hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Đang gửi liên kết đặt lại...' : 'Gửi liên kết đặt lại'}
          {loading && (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-t-transparent dark:border-primary dark:border-t-transparent" />
          )}
        </button>
      </div>
    </form>
  );
}
