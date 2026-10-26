"use client";
import { useState } from "react";
import { useNotificationPreferences, useAvailableChannels } from "@/hooks/use-api";
import { BellIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import ErrorDisplay from "@/components/Common/ErrorDisplay";
export default function NotificationPreferencesPage() {
  const { data: preferences, loading, error, permissions } = useNotificationPreferences();
  const { data: channels } = useAvailableChannels();

  // Use permissions from API response, fallback to false if not available
  const canManage = permissions?.can_manage ?? false;

  const [localPreferences, setLocalPreferences] = useState<any>(preferences || {});

  if (preferences && !localPreferences.id) {
    setLocalPreferences(preferences);
  }

  if (error && !loading) {
    return <ErrorDisplay error={error} title="Cài đặt thông báo" onRetry={() => window.location.reload()} />;
  }

  const handleToggle = (type: string, channel: string, enabled: boolean) => {
    setLocalPreferences((prev: any) => ({
      ...prev,
      [type]: {
        ...prev[type],
        channels: {
          ...prev[type]?.channels,
          [channel]: enabled,
        },
      },
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark dark:text-white">Cài đặt thông báo</h1>
          <p className="text-dark-4 dark:text-dark-6 mt-1">
            Quản lý cách bạn nhận thông báo
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-white transition-colors hover:bg-primary/90">
          <CheckCircleIcon className="h-5 w-5" />
          Lưu thay đổi
        </button>
      </div>

      {/* Notification Types */}
      {loading ? (
        <div className="space-y-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-lg bg-white p-6 dark:bg-gray-800 animate-pulse">
              <div className="space-y-4">
                <div className="h-6 w-48 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-4 w-full rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-10 w-32 rounded bg-gray-200 dark:bg-gray-700" />
              </div>
            </div>
          ))}
        </div>
      ) : preferences && Object.keys(preferences).length > 0 ? (
        <div className="space-y-6">
          {Object.entries(preferences).map(([type, config]: [string, any]) => (
            <div
              key={type}
              className="rounded-lg bg-white p-6 dark:bg-gray-800"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <BellIcon className="h-6 w-6 text-primary" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {config.label || type}
                    </h3>
                  </div>
                  {config.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {config.description}
                    </p>
                  )}
                </div>
                {canManage ? (
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.enabled !== false}
                      onChange={(e) => {
                        setLocalPreferences((prev: any) => ({
                          ...prev,
                          [type]: {
                            ...prev[type],
                            enabled: e.target.checked,
                          },
                        }));
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/40 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                  </label>
                ) : (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {config.enabled !== false ? 'Bật' : 'Tắt'}
                  </div>
                )}
              </div>

              {config.enabled !== false && (
                <div className="mt-4 space-y-3">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Kênh nhận thông báo:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {channels?.map((channel: any) => (
                      <label
                        key={channel.value}
                        className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={localPreferences[type]?.channels?.[channel.value] !== false}
                          onChange={(e) => handleToggle(type, channel.value, e.target.checked)}
                          disabled={!canManage}
                          className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary dark:bg-gray-700 dark:border-gray-600 disabled:cursor-not-allowed"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {channel.label}
                          </div>
                          {channel.description && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {channel.description}
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg bg-white p-8 text-center dark:bg-gray-800">
          <BellIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Không có cài đặt thông báo nào</p>
        </div>
      )}
    </div>
  );
}

