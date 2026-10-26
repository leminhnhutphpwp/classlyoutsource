"use client";
import Link from "next/link";
import {
  CalendarIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import Button from "@/components/Common/Button";
import { formatCurrency } from "@/lib/format-currency";

export interface Reminder {
  id: string;
  category: 'schedule' | 'payment' | 'assignment';
  type: string;
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  action_url: string;
  action_label: string;
  days_overdue?: number | null;
  days_remaining?: number;
  session_date?: string;
  start_time?: string;
  end_time?: string;
  mode?: 'online' | 'offline';
  location?: string;
  amount?: number;
  due_date?: string;
  unsubmitted_count?: number;
  ungraded_count?: number;
  assignment?: {
    id: string;
    title: string;
  };
  class?: {
    id: string;
    name: string;
  };
}

interface ReminderCardProps {
  reminder: Reminder;
  targetUrl?: string;
  variant?: 'default' | 'widget';
}

const getPriorityStyles = (reminder: Reminder, variant: 'default' | 'widget' = 'default') => {
  const baseStyles = variant === 'widget'
    ? 'rounded-lg border transition-all bg-white dark:bg-gray-800'
    : 'rounded-xl border bg-white dark:bg-gray-800';

  // Check for overdue status (for both schedule and assignment)
  const isOverdue = reminder.days_overdue !== null && reminder.days_overdue !== undefined && reminder.days_overdue > 0;
  const isDueToday = reminder.days_remaining !== undefined && reminder.days_remaining === 0;
  const isDueSoon = reminder.days_remaining !== undefined && reminder.days_remaining > 0 && reminder.days_remaining <= 2;
  const isOverdueByDays = reminder.days_remaining !== undefined && reminder.days_remaining < 0;

  // Overdue takes highest priority - only border color, no background
  if (isOverdue || isOverdueByDays || reminder.type?.includes('overdue')) {
    return `${baseStyles} border-red-500 dark:border-red-400`;
  }

  // Due today or high priority - only border color, no background
  if (isDueToday || reminder.priority === 'high') {
    return `${baseStyles} border-red-500 dark:border-red-400`;
  }

  // Due soon (1-2 days) or medium priority - only border color, no background
  if (isDueSoon || reminder.priority === 'medium') {
    return `${baseStyles} border-yellow-500 dark:border-yellow-400`;
  }

  // Low priority or default - only border color, no background
  return `${baseStyles} border-gray-300 dark:border-gray-600`;
};

const getPriorityIcon = (reminder: Reminder) => {
  if (reminder.category === 'payment') {
    return <CurrencyDollarIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />;
  }
  if (reminder.category === 'assignment') {
    return <DocumentTextIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />;
  }
  if (reminder.type.includes('overdue') || reminder.days_overdue) {
    return <ExclamationTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-400" />;
  }
  return <CalendarIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
};

const formatDate = (dateString?: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const formatTime = (timeString?: string) => {
  if (!timeString) return '';
  return timeString;
};

export default function ReminderCard({ reminder, targetUrl, variant = 'default' }: ReminderCardProps) {
  const finalTargetUrl = targetUrl || reminder.action_url;

  return (
    <div className={`p-3 sm:p-4 ${getPriorityStyles(reminder, variant)}`}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0 mt-0.5">
            {getPriorityIcon(reminder)}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white mb-1 break-words">
              {reminder.title}
            </h4>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mb-2 break-words">
              {reminder.message}
            </p>

            {/* Schedule details */}
            {reminder.session_date && (
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
                <span className="flex items-center gap-1 whitespace-nowrap">
                  <CalendarIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                  <span className="truncate">{formatDate(reminder.session_date)}</span>
                </span>
                {reminder.start_time && (
                  <span className="flex items-center gap-1 whitespace-nowrap">
                    <ClockIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                    <span className="truncate">
                      {formatTime(reminder.start_time)}
                      {reminder.end_time && ` - ${formatTime(reminder.end_time)}`}
                    </span>
                  </span>
                )}
                {reminder.mode && (
                  <span className="px-1.5 sm:px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-xs whitespace-nowrap">
                    {reminder.mode === 'online' ? 'Trực tuyến' : 'Trực tiếp'}
                  </span>
                )}
              </div>
            )}

            {/* Payment details */}
            {reminder.amount && (
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {formatCurrency(reminder.amount)}
                </span>
                {reminder.due_date && (
                  <span className="whitespace-nowrap">• Đến hạn: {formatDate(reminder.due_date)}</span>
                )}
              </div>
            )}

            {/* Assignment details */}
            {reminder.category === 'assignment' && (
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
                {reminder.unsubmitted_count !== undefined && reminder.unsubmitted_count > 0 && (
                  <span className="inline-flex items-center rounded-full bg-orange-100 px-2 sm:px-2.5 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                    {reminder.unsubmitted_count} học viên chưa nộp
                  </span>
                )}
                {reminder.ungraded_count !== undefined && reminder.ungraded_count > 0 && (
                  <span className="inline-flex items-center rounded-full bg-purple-100 px-2 sm:px-2.5 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                    {reminder.ungraded_count} bài chưa chấm
                  </span>
                )}
                {reminder.due_date && (
                  <span className="whitespace-nowrap">• Đến hạn: {formatDate(reminder.due_date)}</span>
                )}
              </div>
            )}

            {/* Status badges */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2">
              {reminder.days_overdue !== null && reminder.days_overdue !== undefined && reminder.days_overdue > 0 && (
                <span className="inline-flex items-center rounded-full bg-red-100 px-2 sm:px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400">
                  Quá hạn {reminder.days_overdue} ngày
                </span>
              )}
              {/* Only show "Còn X ngày" if not overdue */}
              {reminder.days_remaining !== undefined &&
                !(reminder.days_overdue !== null && reminder.days_overdue !== undefined && reminder.days_overdue > 0) && (
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2 sm:px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                    Còn {Math.max(0, reminder.days_remaining)} ngày
                  </span>
                )}
              {reminder.class && (
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2 sm:px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-300 truncate max-w-[150px] sm:max-w-none">
                  {reminder.class.name}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex-shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
          <Link href={finalTargetUrl} className="block w-full sm:w-auto">
            <Button
              size="sm"
              variant="outline"
              className="w-full sm:w-auto whitespace-nowrap"
            >
              {reminder.action_label}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

