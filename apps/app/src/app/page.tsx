"use client";
import { useAuthContext } from "@/contexts/auth-context";
import { getLandingPath } from "@/lib/landing-path";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export default function HomePage() {
  const { user, isAuthenticated, loading } = useAuthContext();
  const router = useRouter();
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Chỉ redirect khi đã có thông tin xác thực và chưa redirect
    if (!loading && !hasRedirected.current) {
      hasRedirected.current = true;

      if (isAuthenticated) {
        // Phụ huynh về /family, còn lại về /dashboard
        router.replace(getLandingPath(user));
      } else {
        // Middleware sẽ xử lý redirect này, nhưng để backup
        router.replace("/auth/sign-in");
      }
    }
  }, [isAuthenticated, loading, router, user]);

  // Show loading state
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
