"use client";

import { formatLoginHistoryDate, getLoginStatusMeta } from "@/constants/login-history";
import type { LoginHistoryEntry } from "@/types/login-history";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import UserInfoBox from "@/components/User/UserInfoBox";
import { getObjId } from "@/lib/id-utils";

type LoginHistoryListProps = {
  entries: LoginHistoryEntry[];
  loading?: boolean;
  emptyText?: string;
  hideLocation?: boolean;
};

export function LoginHistoryList({
  entries,
  loading = false,
  emptyText = "Không tìm thấy phiên đăng nhập phù hợp.",
  hideLocation = false,
}: LoginHistoryListProps) {
  if (loading) {
    const columnCount = hideLocation ? 5 : 6;
    return (
      <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/30">
        <div className={`grid gap-4 px-4 py-3 text-sm font-semibold text-gray-400 dark:text-gray-500 ${hideLocation ? 'grid-cols-5' : 'grid-cols-6'}`}>
          {[...Array(columnCount)].map((_, index) => (
            <div
              key={index}
              className="h-4 rounded bg-gray-100 dark:bg-gray-800"
            />
          ))}
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {[...Array(3)].map((_, index) => (
            <div key={index} className={`grid gap-4 px-4 py-3 ${hideLocation ? 'grid-cols-5' : 'grid-cols-6'}`}>
              {[...Array(columnCount)].map((__, idx) => (
                <div
                  key={`${index}-${idx}`}
                  className="h-4 rounded bg-gray-100 dark:bg-gray-800"
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center dark:border-gray-700 dark:bg-gray-900/40">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
          <MagnifyingGlassIcon className="h-6 w-6 text-gray-500 dark:text-gray-400" />
        </div>
        <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
          Không có dữ liệu
        </h3>
        <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">
          {emptyText}
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile Card View */}
      <div className="block lg:hidden rounded-lg bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
        {entries.map((entry, index) => (
          <LoginHistoryCard
            key={getObjId(entry) || `${entry.logged_in_at}-${entry.ip_address}-${index}`}
            entry={entry}
            hideLocation={hideLocation}
          />
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/30">
        <table className="min-w-[800px] w-full divide-y divide-gray-100 text-left text-sm dark:divide-gray-800">
          <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:text-gray-400">
            <tr>
              <th className="px-4 py-3">Người dùng</th>
              <th className="px-4 py-3 min-w-[140px]">Trạng thái</th>
              <th className="px-4 py-3">Thiết bị</th>
              {!hideLocation && (
                <th className="px-4 py-3">IP / Vị trí</th>
              )}
              <th className="px-4 py-3">Thời gian</th>
              <th className="px-4 py-3">Ghi chú</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {entries.map((entry, index) => (
              <LoginHistoryRow
                key={getObjId(entry) || `${entry.logged_in_at}-${entry.ip_address}-${index}`}
                entry={entry}
                hideLocation={hideLocation}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function LoginHistoryRow({ entry, hideLocation = false }: { entry: LoginHistoryEntry; hideLocation?: boolean }) {
  const statusMeta = getLoginStatusMeta(entry.status);
  const deviceName = entry.device?.name || entry.device_name || "Không xác định";
  const deviceLocation = entry.device?.location || entry.location || "Không rõ";

  return (
    <tr className="text-sm text-gray-600 dark:text-gray-300">
      <td className="px-4 py-3">
        <UserInfoBox
          name={(entry as any).name || (entry as any).user?.name || (entry as any).student?.name || entry.email || "Không xác định"}
          email={entry.email || ""}
          avatar={(entry as any).avatar || (entry as any).user?.avatar || (entry as any).student?.avatar}
          emailVerified={(entry as any).email_verified || (entry as any).user?.email_verified || false}
          studentCode={(entry as any).student_code || (entry as any).user?.student_code || (entry as any).student?.student_code}
          size="sm"
          layout="horizontal"
        />
        {!hideLocation && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 pl-[52px]">
            IP: {entry.ip_address || "Không rõ"}
          </div>
        )}
      </td>
      <td className="px-4 py-3 min-w-[140px]">
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusMeta.badgeClass}`}>
          {statusMeta.label}
        </span>
      </td>
      <td className="px-4 py-3">
        <div>{deviceName}</div>
      </td>
      {!hideLocation && (
        <td className="px-4 py-3">
          <div>{deviceLocation}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {entry.location || "Không rõ"}
          </div>
        </td>
      )}
      <td className="px-4 py-3 whitespace-nowrap">
        {formatLoginHistoryDate(entry.logged_in_at)}
      </td>
      <td className="px-4 py-3">
        <div className="line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
          {entry.message || "—"}
        </div>
      </td>
    </tr>
  );
}

function LoginHistoryCard({ entry, hideLocation = false }: { entry: LoginHistoryEntry; hideLocation?: boolean }) {
  const statusMeta = getLoginStatusMeta(entry.status);
  const deviceName = entry.device?.name || entry.device_name || "Không xác định";
  const deviceLocation = entry.device?.location || entry.location || "Không rõ";

  return (
    <div className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <UserInfoBox
              name={(entry as any).name || (entry as any).user?.name || (entry as any).student?.name || entry.email || "Không xác định"}
              email={entry.email || ""}
              avatar={(entry as any).avatar || (entry as any).user?.avatar || (entry as any).student?.avatar}
              emailVerified={(entry as any).email_verified || (entry as any).user?.email_verified || false}
              studentCode={(entry as any).student_code || (entry as any).user?.student_code || (entry as any).student?.student_code}
              size="sm"
              layout="horizontal"
            />
            {!hideLocation && entry.ip_address && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 pl-[52px]">
                IP: {entry.ip_address}
              </div>
            )}
          </div>
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold flex-shrink-0 ${statusMeta.badgeClass}`}>
            {statusMeta.label}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          <div>
            <span className="text-gray-500 dark:text-gray-400 font-medium">Thiết bị:</span>
            <div className="text-gray-900 dark:text-white mt-0.5 truncate">
              {deviceName}
            </div>
          </div>

          {!hideLocation && (
            <div>
              <span className="text-gray-500 dark:text-gray-400 font-medium">Vị trí:</span>
              <div className="text-gray-900 dark:text-white mt-0.5 truncate">
                {deviceLocation}
              </div>
            </div>
          )}

          <div className={!hideLocation ? "" : "col-span-2"}>
            <span className="text-gray-500 dark:text-gray-400 font-medium">Thời gian:</span>
            <div className="text-gray-900 dark:text-white mt-0.5">
              {formatLoginHistoryDate(entry.logged_in_at)}
            </div>
          </div>

          {entry.message && (
            <div className="col-span-2">
              <span className="text-gray-500 dark:text-gray-400 font-medium">Ghi chú:</span>
              <div className="text-gray-900 dark:text-white mt-0.5 line-clamp-2">
                {entry.message}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

