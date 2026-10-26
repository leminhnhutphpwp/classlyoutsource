"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import Tooltip from "@/components/Common/Tooltip";

interface SummaryCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  iconBgColor?: string;
  iconTextColor?: string;
  href?: string;
  tooltipLabel?: string;
}

export default function SummaryCard({
  icon,
  label,
  value,
  iconBgColor = "bg-primary-pastel/40",
  iconTextColor = "text-primary",
  href,
  tooltipLabel = "Xem báo cáo",
}: SummaryCardProps) {
  return (
    <div className="relative rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
      {href && (
        <div className="absolute top-2 right-2">
          <Tooltip label={tooltipLabel}>
            <Link
              href={href}
              className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <ArrowRightIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            </Link>
          </Tooltip>
        </div>
      )}
      <div className="flex items-center">
        <div className={`p-2 ${iconBgColor} rounded-lg`}>
          <div className={iconTextColor}>{icon}</div>
        </div>
        <div className="ml-4 min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{label}</p>
          <p className="text-base sm:text-xl lg:text-2xl font-semibold text-gray-900 dark:text-white break-words" title={String(value)}>{value}</p>
        </div>
      </div>
    </div>
  );
}

