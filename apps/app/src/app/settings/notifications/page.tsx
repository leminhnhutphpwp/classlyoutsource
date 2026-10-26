"use client";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNotificationSettings, useBulkUpdateNotificationPreferences } from "@/hooks/use-api";
import { BellIcon } from "@heroicons/react/24/outline";
import { useNotification } from "@/hooks/use-notification";
import { useLockContext } from "@/contexts/lock-context";
import { useErrorDisplay } from "@/components/Common/ErrorDisplay";

interface NotificationType {
  key: string;
  name: string;
  description?: string;
  category: string;
  default_channels?: string[];
}

interface Channel {
  key: string;
  name: string;
  description?: string;
  available?: boolean;
  addon_required?: string;
  icon?: string;
}

interface Preference {
  notification_type: string;
  channels: string[];
  is_enabled: boolean;
}

const categoryLabels: Record<string, string> = {
  payment: "Học phí & Thanh toán",
  limits: "Giới hạn tài nguyên",
  teaching: "Lớp học & Lịch học",
  team: "Thông báo hệ thống",
  general: "Thông báo chung",
};

export default function NotificationSettingsPage() {
  const { actionsLocked, planFeatureMessage } = useLockContext();
  const { renderError } = useErrorDisplay("Thông báo");
  const { data: settingsData, loading, refetch, permissions } = useNotificationSettings({
    enabled: !actionsLocked,
  });
  const { mutate: updatePreferences } = useBulkUpdateNotificationPreferences();
  const { success, error: showError } = useNotification();

  // Use permissions from API response, fallback to true if not available (API mới có thể không trả về permissions)
  // Nếu user đã đăng nhập và có quyền truy cập settings, họ có thể quản lý notifications
  const canManage = permissions?.can_manage ?? true;

  const channels: Channel[] = useMemo(
    () => (Array.isArray(settingsData?.available_channels) ? settingsData.available_channels : []),
    [settingsData?.available_channels]
  );
  const notificationTypes: NotificationType[] = useMemo(
    () => (Array.isArray(settingsData?.notification_types) ? settingsData.notification_types : []),
    [settingsData?.notification_types]
  );
  // API mới trả về preferences là object, không phải array
  const preferencesData = useMemo(
    () => settingsData?.preferences || {},
    [settingsData?.preferences]
  );
  const preferences: Preference[] = useMemo(
    () =>
      typeof preferencesData === 'object' && !Array.isArray(preferencesData)
        ? Object.values(preferencesData)
        : Array.isArray(preferencesData)
          ? preferencesData
          : [],
    [preferencesData]
  );

  // Helper function: Lấy default channel (email)
  const getDefaultChannel = useCallback((): string => {
    const defaultChannel = channels.find((ch) => ch.available !== false && !ch.addon_required);
    return defaultChannel?.key || (channels.length > 0 ? channels[0].key : 'email');
  }, [channels]);

  // Helper function: Đảm bảo channels không rỗng
  const ensureChannelsNotEmpty = useCallback((prefChannels: string[]): string[] => {
    if (prefChannels.length === 0) {
      return [getDefaultChannel()];
    }
    return prefChannels;
  }, [getDefaultChannel]);

  // Tạo map preferences theo notification_type để dễ truy cập
  const preferencesMap = useMemo(() => {
    const map: Record<string, Preference> = {};
    // Nếu preferences là object (API mới)
    if (typeof preferencesData === 'object' && !Array.isArray(preferencesData)) {
      Object.values(preferencesData).forEach((pref: any) => {
        if (pref && pref.notification_type) {
          map[pref.notification_type] = pref;
        }
      });
    } else if (Array.isArray(preferences)) {
      // Fallback cho format cũ (array)
      preferences.forEach((pref) => {
        map[pref.notification_type] = pref;
      });
    }
    return map;
  }, [preferencesData, preferences]);

  // Tạo map notification types theo category
  const typesByCategory = useMemo(() => {
    const map: Record<string, NotificationType[]> = {};
    notificationTypes.forEach((type) => {
      if (!map[type.category]) {
        map[type.category] = [];
      }
      map[type.category].push(type);
    });
    return map;
  }, [notificationTypes]);

  // Local state để quản lý preferences
  const [localPreferences, setLocalPreferences] = useState<Record<string, Preference>>({});

  // Tạo key ổn định từ preferences array
  const preferencesKey = useMemo(() => {
    if (preferences.length === 0) return '';
    return JSON.stringify(
      preferences.map(p => ({
        type: p.notification_type,
        enabled: p.is_enabled,
        channels: [...p.channels].sort()
      })).sort((a, b) => a.type.localeCompare(b.type))
    );
  }, [preferences]);

  const notificationTypesKey = useMemo(() => {
    if (notificationTypes.length === 0) return '';
    return JSON.stringify(
      notificationTypes.map(t => t.key).sort()
    );
  }, [notificationTypes]);

  // Tạo mapped preferences từ API data
  const mappedPreferences = useMemo(() => {
    const mapped: Record<string, Preference> = {};
    notificationTypes.forEach((type) => {
      const existing = preferencesMap[type.key];
      mapped[type.key] = existing || {
        notification_type: type.key,
        channels: type.default_channels || [],
        is_enabled: true,
      };
    });
    return mapped;
  }, [notificationTypes, preferencesMap]);

  const combinedKey = `${preferencesKey}-${notificationTypesKey}`;
  const lastKeyRef = useRef<string>('');
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (notificationTypes.length === 0) return;
    if (combinedKey === lastKeyRef.current) return;

    lastKeyRef.current = combinedKey;
    setLocalPreferences(mappedPreferences);
  }, [combinedKey, mappedPreferences, notificationTypes.length]);

  // Cleanup timer khi component unmount
  useEffect(() => {
    return () => {
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
    };
  }, []);

  const savePreferences = async (prefs: Record<string, Preference>) => {
    const changedPreferences: Preference[] = [];

    Object.values(prefs).forEach((pref) => {
      // Validate preference
      if (!pref.notification_type || !Array.isArray(pref.channels)) {
        return;
      }

      // Đảm bảo channels luôn có ít nhất 1 phần tử (API yêu cầu)
      const validatedChannels = ensureChannelsNotEmpty(pref.channels);

      changedPreferences.push({
        notification_type: pref.notification_type,
        channels: validatedChannels,
        is_enabled: pref.is_enabled !== false,
      });
    });

    if (changedPreferences.length === 0) {
      return;
    }

    const result = await updatePreferences({ preferences: changedPreferences });
    if (result.success) {
      success("Cập nhật cài đặt thông báo thành công!");
      refetch();
    } else {
      showError(result.message || "Không thể cập nhật cài đặt");
    }
  };

  const handleToggleChannel = (typeKey: string, channelKey: string, enabled: boolean) => {
    setLocalPreferences((prev) => {
      const current = prev[typeKey] || {
        notification_type: typeKey,
        channels: [],
        is_enabled: true,
      };
      const newChannels = enabled
        ? [...(current.channels || []), channelKey].filter((v, i, a) => a.indexOf(v) === i)
        : (current.channels || []).filter((c) => c !== channelKey);

      const updated = {
        ...prev,
        [typeKey]: {
          ...current,
          channels: newChannels,
        },
      };

      // Auto-save với debounce - chỉ gửi preference đã thay đổi
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
      updateTimerRef.current = setTimeout(() => {
        const prefToSave = updated[typeKey];
        if (!prefToSave?.notification_type) {
          return;
        }

        // Đảm bảo channels không rỗng
        prefToSave.channels = ensureChannelsNotEmpty(prefToSave.channels || []);

        savePreferences({ [typeKey]: prefToSave });
      }, 500);

      return updated;
    });
  };

  const handleToggleEnabled = (typeKey: string, enabled: boolean) => {
    setLocalPreferences((prev) => {
      const current = prev[typeKey] || {
        notification_type: typeKey,
        channels: [],
        is_enabled: true,
      };

      // Nếu bật notification và chưa có channel nào, tự động thêm channel mặc định
      let newChannels = current.channels || [];
      if (enabled && newChannels.length === 0) {
        newChannels = [getDefaultChannel()];
      }

      // Đảm bảo channels luôn có ít nhất 1 phần tử
      const finalChannels = enabled
        ? ensureChannelsNotEmpty(newChannels)
        : (current.channels?.length > 0 ? current.channels : ensureChannelsNotEmpty(newChannels));

      const updated = {
        ...prev,
        [typeKey]: {
          notification_type: typeKey,
          is_enabled: enabled,
          channels: finalChannels,
        },
      };

      // Auto-save với debounce
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
      updateTimerRef.current = setTimeout(() => {
        const prefToSave = updated[typeKey];
        if (!prefToSave?.notification_type) {
          return;
        }

        prefToSave.channels = ensureChannelsNotEmpty(prefToSave.channels || []);
        savePreferences({ [typeKey]: prefToSave });
      }, 500);

      return updated;
    });
  };

  if (actionsLocked || planFeatureMessage) {
    return renderError();
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Thông báo</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Quản lý cách bạn nhận thông báo
          </p>
        </div>
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
      </div>
    );
  }

  const categories = Object.keys(typesByCategory);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Thông báo</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Quản lý cách bạn nhận thông báo. Thay đổi sẽ được lưu tự động.
        </p>
      </div>

      {categories.length > 0 ? (
        <div className="space-y-8">
          {categories.map((category) => {
            const types = typesByCategory[category];
            const categoryLabel = categoryLabels[category] || category;

            return (
              <div key={category} className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
                  {categoryLabel}
                </h2>

                <div className="space-y-4">
                  {types.map((type) => {
                    const preference = localPreferences[type.key];
                    const isEnabled = preference?.is_enabled !== false;
                    const selectedChannels = preference?.channels || [];

                    return (
                      <div
                        key={type.key}
                        className="rounded-lg bg-white p-6 dark:bg-gray-800"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <BellIcon className="h-6 w-6 text-primary flex-shrink-0" />
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {type.name.replace("Lịch dạy", "Lịch học")}
                              </h3>
                            </div>
                            {type.description && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 ml-9">
                                {type.description.replace("lịch dạy", "lịch học")}
                              </p>
                            )}
                          </div>
                          <label className={`relative inline-flex items-center ml-4 flex-shrink-0 ${canManage ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                            <input
                              type="checkbox"
                              checked={isEnabled}
                              onChange={(e) => handleToggleEnabled(type.key, e.target.checked)}
                              disabled={!canManage}
                              className="sr-only peer"
                              aria-label={`${isEnabled ? 'Tắt' : 'Bật'} ${type.name}`}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/40 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                          </label>
                        </div>

                        {isEnabled && channels.length > 0 && (
                          <div className="mt-4 space-y-3">
                            {/* Chỉ hiển thị channels nếu có nhiều hơn 1 channel hoặc có channel cần addon */}
                            {channels.length > 1 || channels.some(ch => ch.addon_required || ch.available === false) ? (
                              <>
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Kênh nhận thông báo:
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {channels.map((channel) => {
                                    const isAvailable = channel.available !== false;
                                    const isSelected = selectedChannels.includes(channel.key);
                                    const isDisabled = !isAvailable || !!channel.addon_required;

                                    return (
                                      <label
                                        key={channel.key}
                                        className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${isDisabled
                                          ? "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50 opacity-60 cursor-not-allowed"
                                          : "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
                                          }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isSelected && !isDisabled}
                                          onChange={(e) =>
                                            handleToggleChannel(type.key, channel.key, e.target.checked)
                                          }
                                          disabled={isDisabled || !canManage}
                                          className="mt-0.5 w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary dark:bg-gray-700 dark:border-gray-600 disabled:cursor-not-allowed"
                                        />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                                              {channel.name}
                                            </div>
                                            {channel.addon_required && (
                                              <span className="text-xs px-2 py-0.5 rounded bg-primary-pastel/60 text-primary-light">
                                                Addon
                                              </span>
                                            )}
                                            {!isAvailable && (
                                              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                                                Không khả dụng
                                              </span>
                                            )}
                                          </div>
                                          {channel.description && (
                                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                              {channel.description}
                                            </div>
                                          )}
                                        </div>
                                      </label>
                                    );
                                  })}
                                </div>
                              </>
                            ) : (
                              // Nếu chỉ có 1 channel và luôn có sẵn, chỉ hiển thị thông tin
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                Thông báo sẽ được gửi qua <span className="font-medium text-gray-700 dark:text-gray-300">{channels[0]?.name || 'Email'}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
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
