"use client";
import Link from "next/link";
import Tooltip from "@/components/Common/Tooltip";
import LoadingSkeleton from "./loading-skeleton";
import { RevenueChartComponent, PaymentMethodsChart } from "./charts";
import { formatCurrency } from "@/lib/format-currency";
import type { BuildDetailUrl, ReportFilters } from "./report-types";
import {
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  ChartBarIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

interface RevenueReportProps {
  revenueLoading: boolean;
  paymentsReportLoading: boolean;
  paymentStatisticsLoading: boolean;
  buildDetailUrl: BuildDetailUrl;
  activeFilters: ReportFilters;
  overviewData: any;
  paymentsReportData: any;
  filteredPaymentStatistics: any;
  revenueStats: { monthly_revenue: number; yearly_revenue: number; average_revenue: number };
  revenueDataArray: any[];
}

export default function RevenueReport({
  revenueLoading,
  paymentsReportLoading,
  paymentStatisticsLoading,
  buildDetailUrl,
  activeFilters,
  overviewData,
  paymentsReportData,
  filteredPaymentStatistics,
  revenueStats,
  revenueDataArray,
}: RevenueReportProps) {
  return (
            <div className="space-y-4 sm:space-y-6">
              {/* Revenue Statistics Summary */}
              {revenueLoading || paymentsReportLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                  <LoadingSkeleton count={3} />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                  <div className="relative rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
                    <div className="absolute top-2 right-2">
                      <Tooltip label="Xem doanh thu chi tiết">
                        <Link
                          href={buildDetailUrl("/payments", {
                            ...(activeFilters.statusPayments !== "all" ? { status: activeFilters.statusPayments } : {}),
                            ...(activeFilters.paymentMethod !== "all" ? { payment_method: activeFilters.paymentMethod } : {})
                          })}
                          className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <ArrowRightIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                        </Link>
                      </Tooltip>
                    </div>
                    <div className="flex items-center">
                      <div className="p-2 bg-primary-100 dark:bg-primary/20 rounded-lg">
                        <CurrencyDollarIcon className="h-6 w-6 text-primary-600 dark:text-primary-300" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Doanh thu</p>
                        <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(overviewData?.total_revenue || paymentsReportData?.summary?.total_amount || paymentsReportData?.total_amount || 0)}
                        </p>
                      </div>
                    </div>
                  </div>
    
                  <div className="relative rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
                    <div className="absolute top-2 right-2">
                      <Tooltip label="Xem doanh thu chi tiết">
                        <Link
                          href={buildDetailUrl("/payments", {
                            ...(activeFilters.statusPayments !== "all" ? { status: activeFilters.statusPayments } : {}),
                            ...(activeFilters.paymentMethod !== "all" ? { payment_method: activeFilters.paymentMethod } : {})
                          })}
                          className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <ArrowRightIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                        </Link>
                      </Tooltip>
                    </div>
                    <div className="flex items-center">
                      <div className="p-2 bg-primary-100 dark:bg-primary/20 rounded-lg">
                        <ArrowTrendingUpIcon className="h-6 w-6 text-primary-600 dark:text-primary-300" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Tháng này</p>
                        <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(revenueStats.monthly_revenue || 0)}
                        </p>
                      </div>
                    </div>
                  </div>
    
                  <div className="relative rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
                    <div className="absolute top-2 right-2">
                      <Tooltip label="Xem doanh thu chi tiết">
                        <Link
                          href={buildDetailUrl("/payments", {
                            ...(activeFilters.statusPayments !== "all" ? { status: activeFilters.statusPayments } : {}),
                            ...(activeFilters.paymentMethod !== "all" ? { payment_method: activeFilters.paymentMethod } : {})
                          })}
                          className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <ArrowRightIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                        </Link>
                      </Tooltip>
                    </div>
                    <div className="flex items-center">
                      <div className="p-2 bg-primary-100 dark:bg-primary/20 rounded-lg">
                        <ChartBarIcon className="h-6 w-6 text-primary-600 dark:text-primary-300" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Năm này</p>
                        <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(revenueStats.yearly_revenue || 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
    
              {/* Revenue Chart */}
              <RevenueChartComponent
                revenueData={revenueDataArray}
                paymentsReportData={paymentsReportData}
                loading={revenueLoading || paymentsReportLoading}
              />
    
              {/* Payment Methods Chart */}
              <PaymentMethodsChart
                data={filteredPaymentStatistics?.by_method || []}
                loading={paymentStatisticsLoading}
              />
            </div>
  );
}
