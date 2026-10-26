"use client";
import Link from "next/link";
import Tooltip from "@/components/Common/Tooltip";
import LoadingSkeleton from "./loading-skeleton";
import EmptyState from "./empty-state";
import { AttendanceByClassChart, AttendanceTrendChart } from "./charts";
import { ListSkeleton } from "@/components/ui/loading";
import type { BuildDetailUrl } from "./report-types";
import {
  CalendarIcon,
  UserGroupIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

interface AttendanceReportProps {
  attendanceReportLoading: boolean;
  buildDetailUrl: BuildDetailUrl;
  attendanceReportData: any;
  filteredAttendanceTopStudents: any[];
}

export default function AttendanceReport({
  attendanceReportLoading,
  buildDetailUrl,
  attendanceReportData,
  filteredAttendanceTopStudents,
}: AttendanceReportProps) {
  return (
            <div className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {attendanceReportLoading ? (
                  <LoadingSkeleton count={2} />
                ) : attendanceReportData ? (
                  <>
                    <div className="relative rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
                      <div className="absolute top-2 right-2">
                        <Tooltip label="Xem chi tiết điểm danh">
                          <Link
                            href={buildDetailUrl("/attendance")}
                            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            <ArrowRightIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                          </Link>
                        </Tooltip>
                      </div>
                      <div className="flex items-center">
                        <div className="p-2 bg-primary-100 dark:bg-primary/20 rounded-lg">
                          <CalendarIcon className="h-6 w-6 text-primary-600 dark:text-primary-300" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Tỷ lệ đi học</p>
                          <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
                            {attendanceReportData?.summary?.attendance_rate ? `${Math.round(attendanceReportData.summary.attendance_rate)}%` : '0%'}
                          </p>
                        </div>
                      </div>
                    </div>
    
                    <div className="relative rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
                      <div className="absolute top-2 right-2">
                        <Tooltip label="Xem chi tiết điểm danh">
                          <Link
                            href={buildDetailUrl("/attendance")}
                            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            <ArrowRightIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                          </Link>
                        </Tooltip>
                      </div>
                      <div className="flex items-center">
                        <div className="p-2 bg-primary-100 dark:bg-primary/20 rounded-lg">
                          <UserGroupIcon className="h-6 w-6 text-primary" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Điểm danh</p>
                          <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
                            {attendanceReportData?.summary?.total_records || 0}
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <EmptyState
                    icon={<CalendarIcon className="h-12 w-12" />}
                    message="Không có dữ liệu điểm danh"
                  />
                )}
              </div>
    
              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Attendance by Class Chart */}
                <AttendanceByClassChart
                  data={attendanceReportData?.by_class || []}
                  loading={attendanceReportLoading}
                />
    
                {/* Attendance Trend Chart */}
                <AttendanceTrendChart
                  data={attendanceReportData?.trend || []}
                  loading={attendanceReportLoading}
                />
              </div>
    
              {/* Top Students */}
              <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top học viên có tỷ lệ đi học cao nhất</h3>
                {attendanceReportLoading ? (
                  <ListSkeleton count={5} showAvatar={true} />
                ) : filteredAttendanceTopStudents && filteredAttendanceTopStudents.length > 0 ? (
                  <div className="space-y-3">
                    {filteredAttendanceTopStudents.map((student: any, index: number) => (
                      <div key={student.student_id || index} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full font-semibold bg-primary-100 dark:bg-primary/20 text-primary-600 dark:text-primary-300">
                            {index + 1}
                          </span>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{student.student_name || 'Không tên'}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{student.class_name || 'Không có lớp'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-gray-900 dark:text-white">
                            {student.attendance_rate ? `${Math.round(student.attendance_rate)}%` : '0%'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{student.total_records || 0} điểm danh</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex h-32 items-center justify-center text-gray-500 dark:text-gray-400">
                    <p>Không có dữ liệu</p>
                  </div>
                )}
              </div>
            </div>
  );
}
