"use client";
import { useAuthContext } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export default function ProtectedRoute({ 
  children, 
  redirectTo = "/auth/sign-in" 
}: ProtectedRouteProps) {
  const { loading, isAuthenticated } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push(redirectTo);
    }
  }, [loading, isAuthenticated, router, redirectTo]);

  // Render children immediately so layout shows up
  // Individual components will handle their own loading states
  // Only redirect if definitely not authenticated
  if (!loading && !isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
