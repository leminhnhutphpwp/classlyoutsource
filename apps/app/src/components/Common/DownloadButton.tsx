"use client";
import { useState } from "react";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { apiClient } from "@/lib/api-client";
import { isZaloApp, getZaloDownloadInstructions } from "@/lib/zalo-utils";

interface DownloadButtonProps {
  url: string;
  filename?: string;
  fileSize?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary" | "ghost";
  children?: React.ReactNode;
  onError?: (error: Error) => void;
}

export default function DownloadButton({
  url,
  filename,
  fileSize,
  className = "",
  size = "md",
  variant = "primary",
  children,
  onError,
}: DownloadButtonProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (downloading) return;

    // Show instructions for Zalo users
    if (isZaloApp()) {
      const shouldProceed = confirm(
        `Bạn đang sử dụng Zalo Mini App.\n\n${getZaloDownloadInstructions()}\n\nBạn có muốn tiếp tục tải xuống không?`
      );
      if (!shouldProceed) return;
    }

    setDownloading(true);
    try {
      await apiClient.downloadFile(url, filename);
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Lỗi khi tải xuống file");
      console.error("Download error:", err);
      
      if (onError) {
        onError(err);
      } else {
        alert(err.message);
      }
    } finally {
      setDownloading(false);
    }
  };

  // Size classes (non-ghost buttons share the uniform 41px height)
  const sizeClasses = {
    sm: variant === "ghost" ? "text-xs gap-1" : "h-[41px] text-xs px-2 gap-1",
    md: variant === "ghost" ? "text-xs gap-1.5" : "h-[41px] text-sm px-3 gap-1.5",
    lg: variant === "ghost" ? "text-sm gap-1.5" : "h-[41px] text-base px-4 gap-2",
  };

  // Variant classes
  const variantClasses = {
    primary: "bg-primary/10 text-primary hover:bg-primary/20 dark:bg-primary/20 dark:hover:bg-primary/30",
    secondary: "border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700",
    ghost: "text-primary hover:text-primary/80 hover:underline",
  };

  const baseClasses = variant === "ghost" 
    ? "inline-flex items-center font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    : "inline-flex items-center rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={downloading}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      title={downloading ? "Đang tải xuống..." : "Tải xuống file"}
    >
      <ArrowDownTrayIcon className={size === "sm" ? "h-3 w-3" : size === "md" ? "h-4 w-4" : "h-5 w-5"} />
      {downloading ? "Đang tải..." : children || "Tải xuống"}
      {fileSize && !downloading && (
        <span className={`opacity-75 ${size === "sm" ? "text-xs" : "text-xs"}`}>
          ({fileSize})
        </span>
      )}
    </button>
  );
}

