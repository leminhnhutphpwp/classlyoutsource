"use client";
import Signin from "@/components/Auth/Signin";
import { useAuthContext } from "@/contexts/auth-context";
import { getLandingPath } from "@/lib/landing-path";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState, useRef } from "react";
import LoginSlider from "@/components/Auth/LoginSlider";
import { Spinner } from "@/components/ui/loading";

export default function SignIn() {
  const { user, isAuthenticated, loading } = useAuthContext();
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [suspended, setSuspended] = useState(false);
  const isLoggingInRef = useRef(false);

  // Buộc đăng xuất do trung tâm khóa tài khoản (ACCOUNT_SUSPENDED) → hiện banner riêng,
  // phân biệt với hết phiên đăng nhập thông thường.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    let flag = false;
    try {
      flag = sessionStorage.getItem('auth_forced_logout') === 'ACCOUNT_SUSPENDED';
      if (flag) sessionStorage.removeItem('auth_forced_logout');
    } catch {
      // ignore
    }
    if (params.get('reason') === 'suspended' || flag) {
      setSuspended(true);
    }
  }, []);

  useEffect(() => {
    const handleBootstrapEnd = () => setIsRedirecting(true);
    const handleLoginStart = () => { isLoggingInRef.current = true; };
    const handleLoginFailed = () => { isLoggingInRef.current = false; };

    window.addEventListener('bootstrap:end', handleBootstrapEnd);
    window.addEventListener('auth:login-start', handleLoginStart);
    window.addEventListener('auth:login-failed', handleLoginFailed);

    if (!loading && isAuthenticated && !document.querySelector('[data-bootstrap-loader]') && !isLoggingInRef.current) {
      router.push(getLandingPath(user));
    }

    return () => {
      window.removeEventListener('bootstrap:end', handleBootstrapEnd);
      window.removeEventListener('auth:login-start', handleLoginStart);
      window.removeEventListener('auth:login-failed', handleLoginFailed);
    };
  }, [loading, isAuthenticated, router, user]);

  if (isRedirecting) {
    return null;
  }

  // Show the spinner (never the form) both while auth is still resolving AND
  // once we know the user is already authenticated — a returning user with a
  // valid cookie is about to be redirected, so painting the full sign-in form
  // for one frame would be a flash. During an in-progress login the child's
  // BootstrapLoader takes over, so isLoggingInRef guards that case.
  if ((loading && !isAuthenticated) || (isAuthenticated && !isLoggingInRef.current)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex relative lg:static overflow-hidden bg-white dark:bg-gray-900">
      {/* Left Column: Image Slider */}
      <div className="absolute inset-0 lg:relative lg:flex-1 lg:block z-0 bg-gray-900">
        <LoginSlider />
      </div>

      {/* Right Column: Clean Form Panel */}
      <div className="w-full lg:w-[480px] xl:w-[600px] flex-none bg-white dark:bg-[#020d1a] backdrop-blur-none relative z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.1)] lg:rounded-l-[35px] lg:-ml-[35px] flex flex-col justify-between overflow-hidden">

        {/* Main Form Content */}
        <div className="px-6 sm:px-12 xl:px-20 w-full flex-1 flex flex-col justify-center mb-10">
          <div className="w-full max-w-[400px] mx-auto">

            <div className="mb-10">
              <h1 className="text-3xl xl:text-4xl font-extrabold text-gray-900 dark:text-white mb-3 tracking-tight leading-tight">
                Hello, <br />
                Welcome Back!
              </h1>
              <p className="text-base text-gray-500 dark:text-gray-400 font-medium">
                Đăng nhập để vào không gian quản lý của bạn.
              </p>
            </div>

            {suspended && (
              <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                Tài khoản của bạn đã bị trung tâm khóa. Vui lòng liên hệ chủ trung tâm để được hỗ trợ.
              </div>
            )}

            <Signin />

            <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Chưa có tài khoản?{" "}
              <Link
                href="/auth/sign-up"
                className="font-semibold text-primary hover:underline"
              >
                Đăng ký
              </Link>
            </p>

          </div>
        </div>

        {/* Footer */}
        <div className="p-6 text-center">
          <p className="text-xs text-gray-300 dark:text-gray-600 font-medium uppercase tracking-wider">
            © 2024 Classly.
          </p>
        </div>
      </div>
    </div>
  );
}
