"use client";
import ForgotPassword from "@/components/Auth/ForgotPassword";
import { useAuthContext } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import LoginSlider from "@/components/Auth/LoginSlider";
import { Spinner } from "@/components/ui/loading";

export default function ForgotPasswordPage() {
  const { isAuthenticated, loading } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [loading, isAuthenticated, router]);

  if (loading || isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
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

            <ForgotPassword />

            <div className="mt-10 pt-6 border-t border-gray-100 dark:border-gray-800 text-center">
              <p className="text-sm text-gray-300 lg:text-gray-500 dark:text-gray-400">
                Nhớ mật khẩu rồi?{" "}
                <Link href="/auth/sign-in" className="font-bold text-primary hover:text-primary-dark transition-all">
                  Đăng nhập ngay
                </Link>
              </p>
            </div>
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
