"use client";
import SummaryCard from "./summary-card";
import TopList from "./top-list";
import LoadingSkeleton from "./loading-skeleton";
import { PaymentMethodsChart, PaymentsByStatusChart } from "./charts";
import { formatCurrency } from "@/lib/format-currency";
import type { BuildDetailUrl, ReportFilters } from "./report-types";
import {
  CreditCardIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";

interface PaymentsReportProps {
  paymentsReportLoading: boolean;
  buildDetailUrl: BuildDetailUrl;
  activeFilters: ReportFilters;
  paymentsReportData: any;
}

export default function PaymentsReport({
  paymentsReportLoading,
  buildDetailUrl,
  activeFilters,
  paymentsReportData,
}: PaymentsReportProps) {
  return (
            <div className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                {paymentsReportLoading ? (
                  <LoadingSkeleton count={3} />
                ) : (
                  <>
                    <SummaryCard
                      icon={<CreditCardIcon className="h-6 w-6" />}
                      label="Thanh toán"
                      value={paymentsReportData?.summary?.total_payments ?? paymentsReportData?.total_payments ?? 0}
                      iconBgColor="bg-primary-100 dark:bg-primary/20"
                      iconTextColor="text-primary-600 dark:text-primary-300"
                      href={buildDetailUrl("/payments", {
                        ...(activeFilters.statusPayments !== "all" ? { status: activeFilters.statusPayments } : {}),
                        ...(activeFilters.paymentMethod !== "all" ? { payment_method: activeFilters.paymentMethod } : {})
                      })}
                    />
                    <SummaryCard
                      icon={<CurrencyDollarIcon className="h-6 w-6" />}
                      label="Tổng tiền"
                      value={formatCurrency(
                        (paymentsReportData?.summary?.total_amount ?? paymentsReportData?.total_amount) || 0
                      )}
                      iconBgColor="bg-primary-100 dark:bg-primary/20"
                      iconTextColor="text-primary-600 dark:text-primary-300"
                      href={buildDetailUrl("/payments", {
                        ...(activeFilters.statusPayments !== "all" ? { status: activeFilters.statusPayments } : {}),
                        ...(activeFilters.paymentMethod !== "all" ? { payment_method: activeFilters.paymentMethod } : {})
                      })}
                    />
                    <SummaryCard
                      icon={<ChartBarIcon className="h-6 w-6" />}
                      label="Trung bình"
                      value={formatCurrency(
                        Math.round(
                          (paymentsReportData?.summary?.average_amount ?? paymentsReportData?.average_amount) || 0
                        )
                      )}
                      iconBgColor="bg-primary-100 dark:bg-primary/20"
                      iconTextColor="text-primary-600 dark:text-primary-300"
                      href={buildDetailUrl("/payments", {
                        ...(activeFilters.statusPayments !== "all" ? { status: activeFilters.statusPayments } : {}),
                        ...(activeFilters.paymentMethod !== "all" ? { payment_method: activeFilters.paymentMethod } : {})
                      })}
                    />
                  </>
                )}
              </div>
    
              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Payment Methods Chart */}
                <PaymentMethodsChart
                  data={paymentsReportData?.by_method || []}
                  loading={paymentsReportLoading}
                />
    
                {/* Payment Status Chart */}
                <PaymentsByStatusChart
                  data={paymentsReportData?.by_status || []}
                  loading={paymentsReportLoading}
                />
              </div>
    
              {/* Top Students */}
              {paymentsReportLoading ? (
                <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">Top học viên thanh toán nhiều nhất</h3>
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700 animate-pulse">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-600" />
                          <div>
                            <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-600 mb-2" />
                            <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-600" />
                          </div>
                        </div>
                        <div className="h-6 w-20 rounded bg-gray-200 dark:bg-gray-600" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : paymentsReportData && paymentsReportData.top_students && paymentsReportData.top_students.length > 0 && (
                <TopList
                  title="Top học viên thanh toán nhiều nhất"
                  items={paymentsReportData.top_students.map((student: any) => ({
                    id: student.student_id,
                    name: student.student_name || 'Không tên',
                    subtitle: `${student.total_payments || 0} thanh toán`,
                    value: formatCurrency(student.total_amount || 0),
                  }))}
                  rankColor="bg-primary/10 text-primary"
                />
              )}
            </div>
  );
}
