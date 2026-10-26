"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useState } from "react";
import InputGroup from "@/components/FormElements/InputGroup";
import { Spinner } from "@/components/ui/loading";
import { useNotification } from "@/hooks/use-notification";

type InviteInfo = {
  email: string;
  name: string | null;
  role: "student" | "parent";
  tutor_name: string | null;
};

const ROLE_LABEL: Record<string, string> = {
  student: "học viên",
  parent: "phụ huynh",
};

function AcceptInviteInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const { error: showError } = useNotification();

  const [loadingInvite, setLoadingInvite] = useState(true);
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Tải thông tin lời mời
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!token) {
        setInviteError("Liên kết lời mời không hợp lệ (thiếu mã lời mời).");
        setLoadingInvite(false);
        return;
      }
      setLoadingInvite(true);
      setInviteError(null);
      try {
        const res = await fetch(`/api/auth/invite/${encodeURIComponent(token)}`, {
          headers: { Accept: "application/json" },
        });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (res.status === 410) {
          setInviteError("Lời mời này đã hết hạn hoặc không còn hợp lệ. Vui lòng liên hệ giáo viên để được mời lại.");
        } else if (res.ok && json?.success && json?.data) {
          setInvite(json.data as InviteInfo);
          setName(json.data.name || "");
        } else {
          setInviteError(json?.message || "Không thể tải thông tin lời mời. Vui lòng thử lại.");
        }
      } catch {
        if (!cancelled) setInviteError("Không thể kết nối đến máy chủ. Vui lòng thử lại sau.");
      } finally {
        if (!cancelled) setLoadingInvite(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!password) next.password = "Vui lòng nhập mật khẩu";
    else if (password.length < 6) next.password = "Mật khẩu phải có ít nhất 6 ký tự";
    if (passwordConfirm !== password) next.password_confirmation = "Mật khẩu nhập lại không khớp";
    setFormErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting || !invite) return;
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/accept-invite", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          token,
          password,
          password_confirmation: passwordConfirm,
          ...(name.trim() ? { name: name.trim() } : {}),
        }),
      });
      const json = await res.json().catch(() => ({}));

      if (res.ok && json?.success) {
        // Cookie đã được BFF set → điều hướng full-page theo vai trò
        const role = json?.data?.user?.role || invite.role;
        window.location.href = role === "parent" ? "/family" : "/dashboard";
        return;
      }

      if (res.status === 410) {
        setInviteError("Lời mời này đã hết hạn hoặc không còn hợp lệ.");
      }
      if (json?.errors && typeof json.errors === "object") {
        const fieldErrors: Record<string, string> = {};
        for (const [field, messages] of Object.entries(json.errors)) {
          fieldErrors[field] = Array.isArray(messages) ? String(messages[0]) : String(messages);
        }
        setFormErrors(fieldErrors);
      }
      showError("Không thể kích hoạt tài khoản", json?.message || "Vui lòng thử lại.");
      setSubmitting(false);
    } catch {
      showError("Lỗi hệ thống", "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại.");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-2 px-4 py-10 dark:bg-[#020d1a]">
      <div className="w-full max-w-[440px] rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800 sm:p-8">
        {loadingInvite ? (
          <div className="flex flex-col items-center justify-center gap-4 py-10">
            <Spinner size="lg" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải thông tin lời mời...</p>
          </div>
        ) : inviteError ? (
          <div className="text-center">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Lời mời không khả dụng</h1>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{inviteError}</p>
            <Link
              href="/auth/sign-in"
              className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-medium text-white transition hover:bg-opacity-90"
            >
              Về trang đăng nhập
            </Link>
          </div>
        ) : invite ? (
          <>
            <div className="mb-8">
              <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
                Chào mừng đến Classly
              </h1>
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                {invite.tutor_name ? (
                  <>
                    <span className="font-semibold text-gray-900 dark:text-white">{invite.tutor_name}</span>{" "}
                    đã mời bạn tham gia với vai trò{" "}
                  </>
                ) : (
                  <>Bạn được mời tham gia với vai trò </>
                )}
                <span className="font-semibold text-primary">{ROLE_LABEL[invite.role] || invite.role}</span>.
              </p>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Đặt mật khẩu để kích hoạt tài khoản <span className="font-medium">{invite.email}</span>.
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <div className="mb-4">
                <InputGroup
                  type="text"
                  label="Họ và tên"
                  name="name"
                  placeholder="Nhập họ tên của bạn"
                  value={name}
                  handleChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="mb-4">
                <InputGroup
                  type="password"
                  label="Mật khẩu"
                  required
                  name="password"
                  placeholder="Ít nhất 6 ký tự"
                  value={password}
                  handleChange={(e) => {
                    setPassword(e.target.value);
                    if (formErrors.password) setFormErrors((p) => ({ ...p, password: "" }));
                  }}
                />
                {formErrors.password && <p className="mt-1 text-sm text-red-500">{formErrors.password}</p>}
              </div>

              <div className="mb-6">
                <InputGroup
                  type="password"
                  label="Nhập lại mật khẩu"
                  required
                  name="password_confirmation"
                  placeholder="Nhập lại mật khẩu"
                  value={passwordConfirm}
                  handleChange={(e) => {
                    setPasswordConfirm(e.target.value);
                    if (formErrors.password_confirmation)
                      setFormErrors((p) => ({ ...p, password_confirmation: "" }));
                  }}
                />
                {formErrors.password_confirmation && (
                  <p className="mt-1 text-sm text-red-500">{formErrors.password_confirmation}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary p-4 font-medium text-white transition hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Đang kích hoạt..." : "Kích hoạt tài khoản"}
                {submitting && (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-t-transparent" />
                )}
              </button>
            </form>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-2 dark:bg-[#020d1a]">
          <Spinner size="lg" />
        </div>
      }
    >
      <AcceptInviteInner />
    </Suspense>
  );
}
