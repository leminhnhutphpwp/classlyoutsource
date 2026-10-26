"use client";

import { useInitialBootstrap } from '@/hooks/use-initial-bootstrap';
import { useFaviconProgress } from "@/hooks/use-favicon-progress";
import { useEffect, useState, useRef } from 'react';
import { Logo } from '@/components/logo';
import LoginSlider from "@/components/Auth/LoginSlider";

const isDarkMode = () => {
  if (typeof window === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
};

interface BootstrapLoaderProps {
  onComplete: (skipped?: boolean) => void;
  onError?: (error: string) => void;
}

export function BootstrapLoader({ onComplete, onError }: BootstrapLoaderProps) {
  const { bootstrap, progress, error } = useInitialBootstrap();

  // Update Favicon Progress
  useFaviconProgress(progress?.progress ?? 0);

  const [skipped, setSkipped] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [failedSteps, setFailedSteps] = useState<string[]>([]);
  const [, setDarkMode] = useState(false);
  const bootstrapStartedRef = useRef(false);
  const callbacksRef = useRef({ onComplete, onError });
  const activeItemRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Sync callbacks to ref to avoid stale closure in useEffect
  useEffect(() => {
    callbacksRef.current = { onComplete, onError };
  }, [onComplete, onError]);

  // Track dark mode for consistent UI
  useEffect(() => {
    setDarkMode(isDarkMode());

    const observer = new MutationObserver(() => setDarkMode(isDarkMode()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    const handleModeUpdate = () => setDarkMode(isDarkMode());
    window.addEventListener('mode-updated', handleModeUpdate);

    return () => {
      observer.disconnect();
      window.removeEventListener('mode-updated', handleModeUpdate);
    };
  }, []);

  useEffect(() => {
    if (bootstrapStartedRef.current) return;
    bootstrapStartedRef.current = true;

    let isMounted = true;

    const runBootstrap = async () => {
      try {
        const result = await bootstrap();

        if (result.success) {
          if (result.skipped) {
            if (isMounted) setSkipped(true);
            callbacksRef.current.onComplete(true);
            return;
          }

          if (isMounted) setIsComplete(true);
          if (isMounted) setFailedSteps(result.failedSteps ?? []);

          // Dispatch events for layout transitions
          window.dispatchEvent(new CustomEvent('bootstrap:redirecting'));

          callbacksRef.current.onComplete(false);
        } else {
          callbacksRef.current.onError?.(result.error || 'Lỗi khởi tạo hệ thống');
        }
      } catch {
        callbacksRef.current.onError?.('Đã xảy ra lỗi không xác định');
      }
    };

    runBootstrap();
    return () => { isMounted = false; };
  }, [bootstrap]);

  // Auto-scroll to active item
  useEffect(() => {
    if (activeItemRef.current && scrollContainerRef.current) {
      activeItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      });
    }
  }, [progress]);

  if (skipped) return null;

  // Build progressive loading steps list from the hook's actual step list.
  // The timeline metadata (titles/descriptions) is carried by the progress
  // object itself — no positional mapping against a global config, so the
  // labels always match the requests actually being made for this role.
  const buildLoadingSteps = () => {
    if (isComplete) {
      return [
        { id: 'ready', label: 'Hoàn tất', completed: true, isActive: false, description: 'Hệ thống đã sẵn sàng' }
      ];
    }

    if (!progress) {
      return [
        { id: 'init', label: 'Khởi tạo...', completed: false, isActive: true, description: 'Đang kết nối hệ thống...' }
      ];
    }

    const { current, steps: allSteps } = progress;

    // Only show: completed items + current active + next 3 items (progressive reveal)
    const PREVIEW_COUNT = 3;

    return allSteps
      .map((step, index) => {
        const stepNumber = index + 1;
        const isCompleted = stepNumber <= current;
        const isActive = stepNumber === current + 1;
        const isUpcoming = stepNumber > current + 1 && stepNumber <= current + 1 + PREVIEW_COUNT;

        // Only add if completed, active, or in preview range
        if (!(isCompleted || isActive || isUpcoming)) return null;

        return {
          id: `step-${stepNumber}`,
          label: step.title,
          description: step.desc,
          completed: isCompleted,
          isActive: isActive,
        };
      })
      .filter(Boolean) as { id: string; label: string; description: string; completed: boolean; isActive: boolean }[];
  };

  const loadingSteps = buildLoadingSteps();

  return (
    <div
      className="fixed inset-0 z-[9999] w-full flex overflow-hidden bg-white dark:bg-gray-900"
      data-bootstrap-loader
    >
      {/* Left Column: Image Slider (Sync with Login Page) */}
      <div className="hidden lg:block lg:flex-1 bg-gray-900">
        <LoginSlider />
      </div>

      {/* Right Column: Clean Loading Panel */}
      <div className="w-full lg:w-[480px] xl:w-[600px] flex-none bg-white dark:bg-[#020d1a] relative z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.1)] lg:rounded-l-[35px] lg:-ml-[35px] flex flex-col justify-between overflow-hidden">

        {/* Main Content Area */}
        <div className="px-6 sm:px-10 xl:px-16 w-full flex-1 flex flex-col justify-center py-12">

          {/* Logo & Heading */}
          <div className="mb-8 animate-fade-in-up">
            <div className="mb-6">
              <Logo size="sm" className="items-start" />
            </div>
            <h1 className="text-2xl xl:text-3xl font-extrabold text-gray-900 dark:text-white mb-2 tracking-tight leading-tight">
              {isComplete ? 'Hoàn tất!' : 'Đang chuẩn bị...'}
            </h1>
            <p className="text-sm text-gray-400 dark:text-gray-500 font-medium max-w-xs">
              {isComplete
                ? 'Hệ thống đã sẵn sàng.'
                : 'Vui lòng đợi giây lát trong khi chúng tôi chuẩn bị không gian làm việc.'
              }
            </p>
          </div>

          {/* Progress Area - Timeline Style */}
          <div className="mb-8 relative">
            <div className="flex items-center justify-between mb-5 px-1">
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-[0.2em]">
                Tiến trình hệ thống
              </span>
              <span className="text-xs font-black text-primary tabular-nums">
                {Math.round(progress?.progress || 0)}%
              </span>
            </div>

            <div
              ref={scrollContainerRef}
              className="max-h-[280px] overflow-y-auto overflow-x-hidden custom-scrollbar pr-2 space-y-0 py-1 relative"
            >
              {/* Vertical Connector Line */}
              <div className="absolute left-[11px] top-4 bottom-4 w-[1px] bg-gray-100 dark:bg-gray-800" />

              {loadingSteps.map((step) => {
                const isActive = step.isActive;
                const isCompleted = step.completed;

                return (
                  <div
                    key={step.id}
                    ref={isActive ? activeItemRef : null}
                    className={`relative flex items-start gap-4 pb-5 last:pb-0 transition-all duration-500 w-full ${isActive ? 'opacity-100' : 'opacity-40'
                      }`}
                  >
                    {/* Status Dot/Icon */}
                    <div className={`
                      relative z-10 flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center transition-all duration-500
                      ${isCompleted
                        ? 'bg-success text-white'
                        : isActive
                          ? 'bg-primary shadow-[0_0_12px_rgba(var(--color-primary-rgb),0.25)]'
                          : 'bg-gray-100 dark:bg-gray-800'
                      }
                    `}>
                      {isCompleted ? (
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <div className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-white animate-ping' : 'bg-gray-300 dark:bg-gray-600'}`} />
                      )}
                    </div>

                    {/* Step Text */}
                    <div className="flex-1 min-w-0 pt-0.5 overflow-hidden">
                      <h4 className={`text-sm font-bold truncate transition-colors duration-300 ${isActive ? 'text-gray-900 dark:text-white' : 'text-gray-400'
                        }`}>
                        {step.label}
                      </h4>
                      {isActive && (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 animate-fade-in line-clamp-2">
                          {step.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Progress Bar */}
          {progress && !isComplete && (
            <div className="space-y-3 animate-fade-in">
              <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out relative"
                  style={{
                    width: `${progress.progress}%`,
                    backgroundColor: 'var(--color-primary)'
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/20 animate-shake">
              <div className="flex gap-3">
                <div className="flex-shrink-0 text-red-500">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-red-900 dark:text-red-300">Lỗi khởi tạo</p>
                  <p className="text-xs text-red-700 dark:text-red-400 mt-1 leading-relaxed">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Soft warning: some steps failed but the app still works */}
          {!error && failedSteps.length > 0 && (
            <div className="mt-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/20">
              <div className="flex gap-3">
                <div className="flex-shrink-0 text-amber-500">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-amber-900 dark:text-amber-300">
                    Đã bỏ qua một số mục
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
                    {failedSteps.join(', ')}. Bạn vẫn có thể sử dụng hệ thống — các mục này sẽ tự tải lại khi truy cập.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-8 text-center border-t border-gray-100 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-900/30">
          <p className="text-xs text-gray-400 dark:text-gray-600 font-medium uppercase tracking-[0.2em]">
            © 2024 Classly.
          </p>
        </div>
      </div>

      {/* Styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          .animate-shimmer {
            animation: shimmer 2s infinite;
          }
          @keyframes fade-in-up {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in-up {
            animation: fade-in-up 0.5s ease-out forwards;
          }
          @keyframes fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          .animate-fade-in {
            animation: fade-in 0.5s ease-out forwards;
          }
        `
      }} />
    </div>
  );
}

