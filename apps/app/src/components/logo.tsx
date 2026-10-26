"use client";

import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ className, size = 'md' }: LogoProps) {
  // Size configurations
  const sizeConfig = {
    sm: {
      logoText: 'text-2xl sm:text-3xl',
      badge: 'text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1',
      slogan: 'text-[9px] sm:text-[10px]',
      gap: 'gap-1 sm:gap-1.5'
    },
    md: {
      logoText: 'text-3xl sm:text-4xl',
      badge: 'text-xs sm:text-sm px-2 sm:px-2.5 py-1 sm:py-1.5',
      slogan: 'text-[10px] sm:text-xs',
      gap: 'gap-1.5 sm:gap-2'
    },
    lg: {
      logoText: 'text-4xl sm:text-5xl',
      badge: 'text-sm sm:text-base px-2.5 sm:px-3 py-1.5 sm:py-2',
      slogan: 'text-xs sm:text-sm',
      gap: 'gap-2 sm:gap-2.5'
    }
  };

  const config = sizeConfig[size];

  return (
    <div className={cn("flex flex-col", config.gap, className)}>
      {/* Brand Name and Plan Badge */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
        {/* Classly Text with Theme Color */}
        <span
          className={cn("font-black tracking-tight", config.logoText)}
          style={{
            fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            fontWeight: 900,
            letterSpacing: '-0.02em',
            display: 'inline-block',
            background: 'linear-gradient(to right, #DC2626, #EF4444, #F59E0B)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
            lineHeight: '1.2',
            paddingBottom: '0.1em'
          }}
        >
          Classly
        </span>
      </div>

      {/* Slogan */}
      <p
        className={cn("font-normal leading-tight text-gray-600 dark:text-gray-600", config.slogan)}
        style={{
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
        }}
      >
        Hệ thống quản lý lớp học chuyên nghiệp
      </p>
    </div>
  );
}
