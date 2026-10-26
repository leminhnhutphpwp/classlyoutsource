"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Tooltip from "@/components/Common/Tooltip";
import { useSubmissions } from "@/hooks/use-api";
import { EyeIcon, DocumentTextIcon, CheckCircleIcon, ClockIcon, XCircleIcon } from "@heroicons/react/24/outline";
import Pagination from "@/components/Common/Pagination";
import SearchInput from "@/components/FormElements/SearchInput";
import SelectInput from "@/components/FormElements/SelectInput";
import { useListPage } from "@/hooks/use-list-page";
import { useLockContext } from "@/contexts/lock-context";
import { useErrorDisplay } from "@/components/Common/ErrorDisplay";
import { formatScore, formatScoreWithPercentage } from "@/lib/format-score";
import { CardSkeleton, GridSkeleton, ListSkeleton } from "@/components/ui/loading";
import { getObjId } from "@/lib/id-utils";

export default function SubmissionsPage() {
  const { actionsLocked, planFeatureMessage } = useLockContext();
  const { renderError } = useErrorDisplay("Bài nộp");
  // Use combined hook for pagination and filters
  const {
    currentPage,
    setCurrentPage,
    filters,
    updateFilter,
    apiFilters,
  } = useListPage({
    defaultPage: 1,
    defaultPerPage: 10,
    filterKeys: ["status", "search"],
    filterDefaults: {
      status: "all",
      search: "",
    },
  });

  // Extract individual filters for easier access
  const statusFilter = filters.status || "all";
  const searchQuery = filters.search || "";

  // Separate state for search input (not synced with URL until search is triggered)
  const [searchInput, setSearchInput] = useState(searchQuery);

  // Sync searchInput with searchQuery when filter changes externally
  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  // Handle search button click or Enter key
  const handleSearch = () => {
    updateFilter("search", searchInput);
  };

  const { data: submissions, loading, error, refetch, meta: submissionsMeta } = useSubmissions(actionsLocked ? undefined : apiFilters);

  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  // Check lock và plan feature trước để ưu tiên hiển thị lock content
  if (actionsLocked || planFeatureMessage) {
    return renderError();
  }

  if (error && !loading) {
    return renderError(error, () => refetch());
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white">Quản lý bài nộp</h1>
          <p className="text-dark-4 dark:text-dark-6 mt-1">
            Xem và chấm điểm bài tập đã nộp
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
        {loading ? (
          <GridSkeleton
            count={4}
            cols={{ mobile: 1, tablet: 2, desktop: 4 }}
            renderItem={(i) => (
              <CardSkeleton
                key={i}
                showAvatar={false}
                showActions={false}
                lines={1}
                className="rounded-lg bg-white p-4 dark:bg-gray-800 md:p-6"
              />
            )}
          />
        ) : (
          <>
            <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
              <div className="flex items-center">
                <div className="p-2 bg-primary-pastel/40 rounded-lg">
                  <DocumentTextIcon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                </div>
                <div className="ml-3 md:ml-4">
                  <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Tổng bài nộp">Tổng bài nộp</p>
                  <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                    {(submissionsMeta as any)?.statistics?.total ?? submissionsMeta?.total ?? 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
              <div className="flex items-center">
                <div className="p-2 bg-primary-pastel/40 rounded-lg">
                  <CheckCircleIcon className="h-6 w-6 text-primary" />
                </div>
                <div className="ml-4">
                  <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Đã chấm">Đã chấm</p>
                  <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
                    {(submissionsMeta as any)?.statistics?.graded ?? 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
              <div className="flex items-center">
                <div className="p-2 bg-primary-pastel/40 rounded-lg">
                  <ClockIcon className="h-6 w-6 text-primary-light" />
                </div>
                <div className="ml-4">
                  <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Chờ chấm">Chờ chấm</p>
                  <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
                    {(submissionsMeta as any)?.statistics?.submitted ?? 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
              <div className="flex items-center">
                <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                  <XCircleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div className="ml-4">
                  <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Nộp muộn">Nộp muộn</p>
                  <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
                    {(submissionsMeta as any)?.statistics?.late ?? 0}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Search and Filters */}
      <div className="rounded-lg bg-white p-4 dark:bg-gray-800">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SearchInput
            label="Tìm kiếm"
            name="search"
            placeholder={loading ? "Đang tải..." : "Tìm kiếm bài nộp..."}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onSearch={handleSearch}
            disabled={loading}
          />
          <SelectInput
            label="Trạng thái"
            name="status"
            value={statusFilter}
            onChange={(e) => updateFilter("status", e.target.value)}
            disabled={loading}
            options={[
              { value: "all", label: "Tất cả trạng thái" },
              { value: "submitted", label: "Chờ chấm" },
              { value: "graded", label: "Đã chấm" },
              { value: "returned", label: "Trả lại" },
            ]}
            placeholder={loading ? "Đang tải..." : "Chọn trạng thái"}
          />
        </div>
      </div>

      {/* Submissions Table */}
      {loading ? (
        <ListSkeleton count={5} showAvatar={true} />
      ) : !submissions || submissions.length === 0 ? (
        <div className="rounded-lg bg-white p-8 text-center dark:bg-gray-800">
          <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
            <DocumentTextIcon className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {searchQuery || statusFilter !== "all" ? "Không tìm thấy bài nộp" : "Chưa có bài nộp nào"}
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            {searchQuery || statusFilter !== "all"
              ? "Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc"
              : "Bài nộp sẽ hiển thị ở đây khi học viên nộp bài"
            }
          </p>
        </div>
      ) : (
        <div className="rounded-lg bg-white dark:bg-gray-800">
          <div className="overflow-x-auto">
            <table className="min-w-[800px] w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Học viên
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Bài tập
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Ngày nộp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Điểm số
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Trạng thái
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {(submissions || []).map((submission: any) => (
                  <tr key={getObjId(submission)} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {submission.student?.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {submission.student?.name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {submission.assignment?.title || "Không có tiêu đề"}
                      </div>
                      {submission.assignment?.max_score && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Tối đa: {submission.assignment.max_score} điểm
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {submission.submitted_at ? new Date(submission.submitted_at).toLocaleDateString('vi-VN') : 'Chưa nộp'}
                      </div>
                      {submission.submitted_at && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(submission.submitted_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                      {submission.is_late && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 mt-1">
                          Nộp muộn
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {submission.status === 'graded' && submission.score !== null ? (
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatScore(submission.score, submission.max_score || submission.assignment?.max_score)}
                          </div>
                          {submission.max_score || submission.assignment?.max_score ? (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {formatScoreWithPercentage(submission.score, submission.max_score || submission.assignment?.max_score).percentage}%
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500 dark:text-gray-400">Chưa chấm</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${submission.status === 'graded'
                        ? 'bg-primary-pastel text-primary'
                        : submission.status === 'returned'
                          ? 'bg-primary-pastel/60 text-primary-light'
                          : 'bg-primary-pastel/40 text-primary'
                        }`}>
                        {submission.status === 'graded' ? 'Đã chấm' :
                          submission.status === 'returned' ? 'Trả lại' :
                            submission.status === 'submitted' ? 'Đã nộp' : 'Chưa nộp'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Tooltip label="Xem bài nộp">
                        <Link
                          href={`/submissions/${getObjId(submission)}`}
                          className="text-primary hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300"
                          aria-label="Xem bài nộp"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </Link>
                      </Tooltip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination - chỉ hiển thị khi có dữ liệu */}
      {submissions && submissions.length > 0 && (
        <Pagination
          meta={submissionsMeta}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          itemLabel="bài nộp"
          className="mt-6"
        />
      )}
    </div>
  );
}

