"use client";
import Link from "next/link";
import React, { useState, useCallback } from "react";
import InputGroup from "../FormElements/InputGroup";
import { Checkbox } from "../FormElements/checkbox";
import { useAuthContext } from "@/contexts/auth-context";
import { getLandingPath } from "@/lib/landing-path";
import { useNotification } from "@/hooks/use-notification";
import { useRouter } from "next/navigation";
import { BootstrapLoader } from "./BootstrapLoader";
import { loginSchema } from "@/lib/validation-schemas";

export default function SigninWithPassword() {
  const { login, verifyTwoFactor, user } = useAuthContext();
  const { error } = useNotification();
  const router = useRouter();

  const [data, setData] = useState({
    email: "",
    password: "",
    remember: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showBootstrap, setShowBootstrap] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  // 2FA second step: set once login returns requires_2fa. While non-null we show the code form.
  const [twoFactorChallenge, setTwoFactorChallenge] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [verifying2fa, setVerifying2fa] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setData({
      ...data,
      [e.target.name]: e.target.value,
    });
    // Clear error for the field being edited
    if (errors[e.target.name]) {
      setErrors({
        ...errors,
        [e.target.name]: "",
      });
    }
  };

  // Điều hướng theo vai trò: phụ huynh về /family, còn lại về /dashboard
  const landingPath = getLandingPath(user);

  const handleBootstrapComplete = useCallback((skipped?: boolean) => {
    if (skipped) {
      setShowBootstrap(false);
      router.push(landingPath);
      return;
    }

    // After bootstrap finishes, we let BootstrapLoader handle the final transition.
    // isRedirecting keeps the loader on screen so we never flash back to the
    // sign-in form during navigation — no artificial delay needed.
    setIsRedirecting(true);
    setShowBootstrap(false);
    window.dispatchEvent(new CustomEvent('bootstrap:end'));
    router.push(landingPath);
  }, [router, landingPath]);

  const handleBootstrapError = useCallback((errorStr: string) => {
    setShowBootstrap(false);
    error('Lỗi tải dữ liệu', errorStr || 'Vẫn có thể tiếp tục sử dụng hệ thống');
    setTimeout(() => {
      router.push(landingPath);
    }, 2000);
  }, [router, error, landingPath]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return; // Prevent double submission

    // Validate using Zod
    const result = loginSchema.safeParse(data);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((err: any) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    setErrors({}); // Clear previous errors

    // Notify parent page that we are handling the login flow
    // This prevents the parent from redirecting automatically when isAuthenticated becomes true
    window.dispatchEvent(new CustomEvent('auth:login-start'));

    try {
      const result = await login(data.email, data.password) as any;

      if (result.success && result.requires_2fa) {
        // Mật khẩu đúng nhưng tài khoản bật 2FA — chuyển sang bước nhập mã, giữ nguyên trang.
        setTwoFactorChallenge(result.challenge);
        setTwoFactorCode("");
        setTwoFactorError("");
        setLoading(false);
        return;
      }

      if (result.success) {
        // Disabled prefetch to ensure we get fresh state after login
        window.dispatchEvent(new CustomEvent('bootstrap:start'));

        // BootstrapLoader's own bootstrap() already waits for AuthContext to
        // populate the user (polling loop), so no artificial delay is needed here.
        setShowBootstrap(true);
      } else {
        // Login failed, allow parent to handle redirects again if needed (though we stay here)
        window.dispatchEvent(new CustomEvent('auth:login-failed'));

        if (
          result.code !== "ACCOUNT_LOCKED" &&
          result.code !== "ACCOUNT_INACTIVE" &&
          result.code !== "TUTOR_INACTIVE"
        ) {
          error("Đăng nhập thất bại", result.error || "Vui lòng kiểm tra lại thông tin");
        }
        setLoading(false);
      }
    } catch (_err) {
      window.dispatchEvent(new CustomEvent('auth:login-failed'));
      error('Lỗi hệ thống', 'Đã xảy ra lỗi không mong muốn');
      setLoading(false);
    }
  };

  const handleVerify2fa = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (verifying2fa || !twoFactorChallenge) return;

    const code = twoFactorCode.trim();
    if (code.length < 6) {
      setTwoFactorError("Vui lòng nhập mã 6 số hoặc mã khôi phục");
      return;
    }

    setVerifying2fa(true);
    setTwoFactorError("");

    try {
      const result = await verifyTwoFactor(twoFactorChallenge, code) as any;
      if (result.success) {
        window.dispatchEvent(new CustomEvent('bootstrap:start'));
        setShowBootstrap(true);
      } else {
        // Challenge hết hạn → quay lại bước nhập mật khẩu.
        if (result.code === 'INVALID_2FA_CHALLENGE') {
          setTwoFactorChallenge(null);
          window.dispatchEvent(new CustomEvent('auth:login-failed'));
          error("Phiên xác thực đã hết hạn", "Vui lòng đăng nhập lại");
        } else {
          setTwoFactorError(result.error || "Mã xác thực không đúng");
        }
        setVerifying2fa(false);
      }
    } catch (_err) {
      setTwoFactorError("Đã xảy ra lỗi. Vui lòng thử lại.");
      setVerifying2fa(false);
    }
  };

  const handleCancel2fa = () => {
    setTwoFactorChallenge(null);
    setTwoFactorCode("");
    setTwoFactorError("");
    window.dispatchEvent(new CustomEvent('auth:login-failed'));
  };

  if (showBootstrap || isRedirecting) {
    return <BootstrapLoader onComplete={handleBootstrapComplete} onError={handleBootstrapError} />;
  }

  if (twoFactorChallenge) {
    return (
      <form onSubmit={handleVerify2fa}>
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Xác thực hai lớp</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Nhập mã 6 số từ ứng dụng xác thực của bạn, hoặc một mã khôi phục.
          </p>
        </div>

        <div className="mb-5">
          <InputGroup
            type="text"
            label="Mã xác thực"
            required
            className="[&_input]:py-[15px] [&_input]:tracking-[0.3em] [&_input]:text-center"
            placeholder="123456"
            name="twoFactorCode"
            handleChange={(e) => {
              setTwoFactorCode(e.target.value);
              if (twoFactorError) setTwoFactorError("");
            }}
            value={twoFactorCode}
          />
          {twoFactorError && <p className="mt-1 text-sm text-red-500">{twoFactorError}</p>}
        </div>

        <div className="mb-4.5">
          <button
            type="submit"
            disabled={verifying2fa}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary p-4 font-medium text-white transition hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {verifying2fa ? 'Đang xác thực...' : 'Xác nhận'}
            {verifying2fa && (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-t-transparent dark:border-primary dark:border-t-transparent" />
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={handleCancel2fa}
          className="w-full text-center text-sm text-gray-500 hover:text-primary dark:text-gray-400"
        >
          Quay lại đăng nhập
        </button>
      </form>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit}>

        <div className="mb-4">
          <InputGroup
            type="email"
            label="Email"
            required
            className="[&_input]:py-[15px]"
            placeholder="Nhập email của bạn"
            name="email"
            handleChange={handleChange}
            value={data.email}
          // Remove HTML5 constraint to allow Zod to handle validation UX
          />
          {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
        </div>

        <div className="mb-5">
          <InputGroup
            type="password"
            label="Mật khẩu"
            required
            className="[&_input]:py-[15px]"
            placeholder="Nhập mật khẩu của bạn"
            name="password"
            handleChange={handleChange}
            value={data.password}
          // Remove HTML5 constraint to allow Zod to handle validation UX
          />
          {errors.password && <p className="mt-1 text-sm text-red-500">{errors.password}</p>}
        </div>

        <div className="mb-6 flex items-center justify-between gap-2 py-2 font-medium">
          <Checkbox
            label="Ghi nhớ đăng nhập"
            name="remember"
            withIcon="check"
            minimal
            radius="md"
            onChange={(e) =>
              setData({
                ...data,
                remember: e.target.checked,
              })
            }
          />

          <Link
            href="/auth/forgot-password"
            className="hover:text-primary dark:text-white dark:hover:text-primary"
          >
            Quên mật khẩu?
          </Link>
        </div>

        <div className="mb-4.5">
          <button
            type="submit"
            disabled={loading}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary p-4 font-medium text-white transition hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            {loading && (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-t-transparent dark:border-primary dark:border-t-transparent" />
            )}
          </button>
        </div>
      </form>
    </>
  );
}

