"use client";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Layouts/sidebar";
import { Header } from "@/components/Layouts/header";
import { useAuthContext } from "@/contexts/auth-context";
import { usePrefetch } from "@/hooks/use-prefetch";
import { useParentRouteGuard } from "@/hooks/use-parent-route-guard";
import { useSidebarContext } from "@/components/Layouts/sidebar/sidebar-context";
import ZaloSecurityNotice from "@/components/Common/ZaloSecurityNotice";
import { Spinner } from "@/components/ui/loading";
import type { PropsWithChildren } from "react";
import { useEffect, useState } from "react";

export default function ConditionalLayout({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const { isAuthenticated, loading } = useAuthContext();
  const { isOpen, isExpanded, isMobile } = useSidebarContext();
  const isAuthPage = pathname === '/auth' || pathname.startsWith('/auth/');
  const [isBootstrapRedirecting, setIsBootstrapRedirecting] = useState(false);
  const [isBootstrapActive, setIsBootstrapActive] = useState(false);
  
  // Prefetch data for current page and related pages
  usePrefetch();

  // Fail-closed guard: keep parents inside the family portal + account settings,
  // even on direct-URL navigation to tutor/student pages.
  useParentRouteGuard();

  // Check if BootstrapLoader is active.
  // The overlay only exists transiently during the login handoff, so we poll the
  // DOM (to track its opacity fade-out) ONLY while a handoff is in flight instead
  // of running a 100ms timer for the whole session. See F3 note in the report.
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    const checkBootstrapLoader = () => {
      const loader = document.querySelector('[data-bootstrap-loader]');
      setIsBootstrapActive(!!loader && loader instanceof HTMLElement && loader.style.opacity !== '0');
      // Once the overlay is fully gone, stop polling.
      if (!loader && interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const startPolling = () => {
      checkBootstrapLoader();
      if (!interval) {
        interval = setInterval(checkBootstrapLoader, 100);
      }
    };

    // Kick off polling on login; also cover the edge case where a loader is
    // already mounted on first render.
    window.addEventListener('bootstrap:start', startPolling);
    if (document.querySelector('[data-bootstrap-loader]')) {
      startPolling();
    } else {
      checkBootstrapLoader();
    }

    return () => {
      window.removeEventListener('bootstrap:start', startPolling);
      if (interval) clearInterval(interval);
    };
  }, []);

  // Listen for bootstrap redirecting event
  useEffect(() => {
    const handleBootstrapRedirecting = () => {
      setIsBootstrapRedirecting(true);
    };

    window.addEventListener('bootstrap:redirecting', handleBootstrapRedirecting);

    return () => {
      window.removeEventListener('bootstrap:redirecting', handleBootstrapRedirecting);
    };
  }, []);

  // Ẩn BootstrapLoader overlay khi trang đích đã sẵn sàng (destination page có
  // skeleton riêng nên không cần chờ nhân tạo)
  useEffect(() => {
    if (!loading && isAuthenticated && !isAuthPage && isBootstrapRedirecting) {
      setIsBootstrapRedirecting(false);

      // Tự động fade-out và gỡ BootstrapLoader overlay nếu còn sót lại
      const loader = document.querySelector('[data-bootstrap-loader]');
      if (loader) {
        loader.classList.add('opacity-0', 'transition-opacity', 'duration-300');
        // 300ms là thời lượng transition fade-out, không phải delay nhân tạo
        const timer = setTimeout(() => {
          if (loader.parentNode) {
            loader.remove();
          }
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, isAuthenticated, isAuthPage, isBootstrapRedirecting]);

  // Không hiển thị loading spinner nếu đang trong quá trình bootstrap redirect
  // BootstrapLoader sẽ tự xử lý UI loading
  if (!isAuthPage && loading && !isBootstrapRedirecting) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-live="polite">
        <Spinner size="lg" />
      </div>
    );
  }

  // Don't render dashboard layout if not authenticated
  if (!isAuthPage && !isAuthenticated) {
    return null;
  }

  if (isAuthPage) {
    return <>{children}</>;
  }

  // Calculate sidebar width for grid layout (only for desktop)
  const getSidebarWidth = () => {
    if (isMobile) {
      // On mobile, sidebar is fixed, so grid doesn't need to account for it
      return '0px';
    }
    if (!isOpen) return '0px';
    return isExpanded ? '290px' : '70px';
  };

  const sidebarWidth = getSidebarWidth();

  return (
    <div 
      className={isMobile ? "flex min-h-screen" : "grid min-h-screen"}
      style={!isMobile ? {
        gridTemplateColumns: `${sidebarWidth} 1fr`,
        transition: 'grid-template-columns 300ms ease-in-out',
      } : undefined}
    >
      {!isBootstrapActive && <Sidebar />}

      <div className={isMobile ? "flex-1 min-w-0 bg-gray-2 dark:bg-[#020d1a] overflow-x-hidden overflow-y-visible" : "min-w-0 bg-gray-2 dark:bg-[#020d1a] overflow-x-hidden overflow-y-visible"}>
        {!isBootstrapActive && <Header />}

        <main className={`isolate mx-auto w-full max-w-screen-2xl overflow-x-hidden overflow-y-visible p-4 md:p-6 2xl:p-10 ${isMobile ? 'pt-24 md:pt-28' : ''}`}>
          <ZaloSecurityNotice />
          {children}
        </main>
      </div>
    </div>
  );
}
