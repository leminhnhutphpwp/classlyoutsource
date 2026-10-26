export interface ReportFilters {
  dateRange: { start: string; end: string } | null;
  statusPayments: string;      // paid, pending, failed, refunded
  statusStudents: string;      // active, inactive, graduated
  statusClasses: string;       // active, inactive, completed
  statusAssignments: string;   // published, draft, closed
  paymentMethod: string;
  classId: string;
}

export type BuildDetailUrl = (
  basePath: string,
  additionalParams?: Record<string, string>,
  includeDateRange?: boolean,
) => string;
