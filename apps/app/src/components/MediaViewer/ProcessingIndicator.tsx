"use client";

interface ProcessingIndicatorProps {
  message?: string;
  className?: string;
}

export default function ProcessingIndicator({ 
  message = "Đang tối ưu media...", 
  className = "" 
}: ProcessingIndicatorProps) {
  return (
    <div className={`flex items-center gap-2 text-sm text-amber-600 ${className}`}>
      <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
      <span>{message}</span>
    </div>
  );
}