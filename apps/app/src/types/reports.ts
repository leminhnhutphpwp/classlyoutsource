/**
 * Type definitions for Reports API filters
 */

export interface DateRangeFilters {
  date_from?: string;
  date_to?: string;
}

export interface PaymentMethodFilter {
  payment_method?: string;
}

export interface StatusFilter {
  status?: string;
}

export interface PeriodFilter {
  period?: number;
}

export type ReportOverviewFilters = DateRangeFilters;

export interface RevenueReportFilters extends DateRangeFilters, PaymentMethodFilter {}

export type ReportStatisticsFilters = DateRangeFilters;

export interface PaymentStatisticsFilters extends DateRangeFilters, PaymentMethodFilter, PeriodFilter {}

export interface PaymentsReportFilters extends DateRangeFilters, PaymentMethodFilter, StatusFilter {}

export interface AttendanceReportFilters extends DateRangeFilters {
  class_id?: string;
}

export interface StudentsReportFilters extends DateRangeFilters, StatusFilter {
  class_id?: string;
}

export interface ClassesReportFilters extends DateRangeFilters, StatusFilter {}

export interface AssignmentsReportFilters extends DateRangeFilters, StatusFilter {
  class_id?: string;
}

