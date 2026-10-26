"use client";

import { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  message: string;
}

export default function EmptyState({ icon, message }: EmptyStateProps) {
  return (
    <div className="flex h-64 items-center justify-center text-gray-500 dark:text-gray-400">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 text-gray-400 mb-2">{icon}</div>
        <p>{message}</p>
      </div>
    </div>
  );
}

