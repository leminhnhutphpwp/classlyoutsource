"use client";

import { SidebarProvider } from "@/components/Layouts/sidebar/sidebar-context";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/auth-context";
import { OrganizationProvider } from "@/contexts/organization-context";
import { LockProvider } from "@/contexts/lock-context";
import { ToastProvider } from "@/contexts/toast-context";
import ThemeManager from "@/components/Layouts/ThemeManager";
import TopLoaderController from "@/components/Layouts/TopLoaderController";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultTheme="light" attribute="class">
      <LockProvider>
        <AuthProvider>
          <OrganizationProvider>
            <ThemeManager />
            <TopLoaderController />
            <SidebarProvider>
              <ToastProvider>
                {children}
              </ToastProvider>
            </SidebarProvider>
          </OrganizationProvider>
        </AuthProvider>
      </LockProvider>
    </ThemeProvider>
  );
}
