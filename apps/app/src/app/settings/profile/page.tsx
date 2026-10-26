"use client";
import React, { useState, useEffect } from "react";
import { useAuthContext } from "@/contexts/auth-context";
import { useUpdateProfile, useUploadAvatar, useProfileSettings } from "@/hooks/use-api";
import InputGroup from "@/components/FormElements/InputGroup";
import {
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  PhotoIcon,
  ArrowPathIcon
} from "@heroicons/react/24/outline";
import { useNotification } from "@/hooks/use-notification";
import Button from "@/components/Common/Button";
import { useLockContext } from "@/contexts/lock-context";
import { useErrorDisplay } from "@/components/Common/ErrorDisplay";
import { themePresets, groupThemesByBase } from "@/config/presets";

export default function ProfileSettingsPage() {
  const { user, refetchUser } = useAuthContext();
  const { actionsLocked, planFeatureMessage } = useLockContext();
  const { renderError } = useErrorDisplay("Hồ sơ");
  const { data: profileData, loading: profileLoading, refetch: refetchProfile } = useProfileSettings({
    enabled: !actionsLocked,
  });
  const { mutate: updateProfile, loading: updatingProfile } = useUpdateProfile();
  const { mutate: uploadAvatar, loading: uploadingAvatar } = useUploadAvatar();
  const { success, error: showError } = useNotification();

  // Extract user from profileData if API returns { user: {...} } structure
  const profile = profileData?.user || profileData || user || {};

  // Helper để lấy avatar URL từ Media hoặc fallback
  const getAvatarUrl = (data: { avatar_media?: { url?: string }; avatar?: string } | null | undefined) => {
    if (!data) return '/images/user/default-avatar.png';
    // Ưu tiên avatar_media.url từ Media
    if (data.avatar_media?.url) return data.avatar_media.url;
    // Fallback về avatar field
    if (data.avatar) return data.avatar;
    return '/images/user/default-avatar.png';
  };

  const avatarUrl = getAvatarUrl(profile) || getAvatarUrl(user) || '/images/user/default-avatar.png';

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    bio: "",
    theme_key: "",
    // Mode is managed separately via ThemeToggleSwitch in header, not in profile form
  });

  const [selectedThemeKey, setSelectedThemeKey] = useState("classly-red-white");
  const [previewThemeKey, setPreviewThemeKey] = useState<string | null>(null);

  useEffect(() => {
    if (!profileLoading) {
      // Extract user from profileData if API returns { user: {...} } structure
      const data = profileData?.user || profileData || user;
      if (data) {
        // Use user's actual theme_key from user context first, then from data
        // This prevents resetting theme when entering profile page
        const userThemeKey = (user?.theme_key) || data.theme_key || "classly-red-white";

        setFormData({
          name: data.name ?? "",
          email: data.email ?? "",
          phone: data.phone ?? "",
          address: data.address ?? "",
          bio: data.bio ?? "",
          theme_key: userThemeKey,
          // Mode is managed separately via ThemeToggleSwitch in header, not in profile form
        });
        setSelectedThemeKey(userThemeKey);
      }
    }
  }, [profileLoading, profileData, user]);

  useEffect(() => {
    return () => {
      setPreviewThemeKey(null);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleModeUpdated = () => {
      setPreviewThemeKey(null);
    };

    window.addEventListener('mode-updated', handleModeUpdated);
    return () => {
      window.removeEventListener('mode-updated', handleModeUpdated);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleThemeSelect = (themeId: string) => {
    setSelectedThemeKey(themeId);
    setFormData(prev => ({ ...prev, theme_key: themeId }));

    if (previewThemeKey !== themeId) {
      setPreviewThemeKey(themeId);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('theme-preview', { detail: { themeKey: themeId } }));
      }
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      showError("Kích thước file không được vượt quá 2MB");
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      showError("Chỉ chấp nhận file ảnh (JPEG, PNG, GIF, WebP)");
      return;
    }

    const result = await uploadAvatar(file);
    if (result.success) {
      success("Cập nhật avatar thành công!");
      refetchUser();
      refetchProfile();
    } else {
      showError(result.message || "Không thể upload avatar");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Build update payload - mode is NOT included as it's managed separately via ThemeToggleSwitch
    const updatePayload = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      address: formData.address,
      bio: formData.bio,
      theme_key: formData.theme_key,
      // Mode is managed separately via ThemeToggleSwitch in header, not in profile form
    };

    const result = await updateProfile(updatePayload);
    if (result.success) {
      success("Cập nhật hồ sơ thành công!");
      setPreviewThemeKey(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('theme-preview', { detail: { themeKey: formData.theme_key } }));
      }
      refetchUser();
      refetchProfile();
    } else {
      showError(result.message || "Không thể cập nhật hồ sơ");
    }
  };

  if (actionsLocked || planFeatureMessage) {
    return renderError();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Hồ sơ</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Quản lý thông tin cá nhân của bạn
        </p>
      </div>

      <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
        {/* Avatar Upload */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Ảnh đại diện
          </label>
          {profileLoading ? (
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
              <div className="h-24 w-24 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse flex-shrink-0" />
              <div className="space-y-2 text-center sm:text-left">
                <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mx-auto sm:mx-0" />
                <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mx-auto sm:mx-0" />
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
              <div className="relative flex-shrink-0">
                <div className="relative">
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/images/user/default-avatar.png';
                    }}
                    className={`h-24 w-24 rounded-full object-cover border-4 border-gray-200 dark:border-gray-700 transition-opacity aspect-square ${uploadingAvatar ? 'opacity-50' : 'opacity-100'
                      }`}
                    style={{ objectFit: 'cover' }}
                  />
                  {uploadingAvatar && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-full">
                      <div className="animate-spin rounded-full h-8 w-8 border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                    </div>
                  )}
                </div>
                <label className={`absolute bottom-0 right-0 bg-primary text-white rounded-full p-2 cursor-pointer hover:bg-primary/90 transition-colors shadow-md ${uploadingAvatar ? 'opacity-50 cursor-not-allowed' : ''
                  }`}>
                  <PhotoIcon className="h-4 w-4" />
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    onChange={handleAvatarChange}
                    className="hidden"
                    disabled={uploadingAvatar}
                  />
                </label>
              </div>
              <div className="text-center sm:text-left">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  JPG, PNG, GIF hoặc WebP. Tối đa 2MB.
                </p>
                {uploadingAvatar && (
                  <p className="text-xs sm:text-sm text-primary mt-1 flex items-center justify-center sm:justify-start gap-2">
                    <ArrowPathIcon className="h-3 w-3 animate-spin" />
                    Đang upload...
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile Form */}
        {profileLoading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
            <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
              <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
            <div className="flex items-center gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={updatingProfile ? 'opacity-50 pointer-events-none' : ''}>
                <InputGroup
                  type="text"
                  label="Họ và tên"
                  placeholder="Nhập họ và tên"
                  name="name"
                  value={formData.name}
                  handleChange={handleChange}
                  icon={<UserIcon className="h-5 w-5" />}
                  required
                  disabled={updatingProfile}
                />
              </div>

              <div className={updatingProfile ? 'opacity-50 pointer-events-none' : ''}>
                <InputGroup
                  type="email"
                  label="Email"
                  placeholder="Nhập email"
                  name="email"
                  value={formData.email}
                  handleChange={handleChange}
                  icon={<EnvelopeIcon className="h-5 w-5" />}
                  disabled={true}
                  required
                />
              </div>

              <div className={updatingProfile ? 'opacity-50 pointer-events-none' : ''}>
                <InputGroup
                  type="tel"
                  label="Số điện thoại"
                  placeholder="Nhập số điện thoại"
                  name="phone"
                  value={formData.phone}
                  handleChange={handleChange}
                  icon={<PhoneIcon className="h-5 w-5" />}
                  disabled={updatingProfile}
                />
              </div>

              <div className={`md:col-span-2 ${updatingProfile ? 'opacity-50 pointer-events-none' : ''}`}>
                <InputGroup
                  type="text"
                  label="Địa chỉ"
                  placeholder="Nhập địa chỉ"
                  name="address"
                  value={formData.address || ""}
                  handleChange={handleChange}
                  icon={<UserIcon className="h-5 w-5" />}
                  disabled={updatingProfile}
                />
              </div>
            </div>

            <div className={updatingProfile ? 'opacity-50 pointer-events-none' : ''}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Giới thiệu về bản thân
              </label>
              <textarea
                name="bio"
                value={formData.bio || ""}
                onChange={handleChange}
                placeholder="Viết một chút về bản thân..."
                rows={4}
                disabled={updatingProfile}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:opacity-70 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-primary"
              />
            </div>

            {/* Theme Selection Section */}
            <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-4">
                Giao diện & Màu sắc
              </h3>
              <div className="space-y-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Chọn bộ giao diện (theme) yêu thích. Mỗi theme bao gồm một bộ màu được thiết kế sẵn và sẽ áp dụng cho toàn bộ giao diện giáo viên.
                </p>

                {/* Group themes by base theme */}
                <div className="space-y-5">
                  {Object.entries(groupThemesByBase()).map(([baseId, themes]) => {
                    const baseTheme = themes.find(t => !t.id.includes('-white')) || themes[0];
                    const baseName = baseTheme.name.replace(' (Mặc định)', '').replace(' (Sidebar trắng)', '');

                    return (
                      <div key={baseId} className="space-y-3">
                        {/* Group header - improved design */}
                        <div
                          className="relative overflow-hidden rounded-lg px-4 py-3 border border-gray-200 dark:border-gray-700"
                          style={{
                            background: `linear-gradient(135deg, ${baseTheme.primary}15 0%, ${baseTheme.primary}08 100%)`
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="h-8 w-8 rounded-lg shadow-md flex-shrink-0"
                              style={{ backgroundColor: baseTheme.primary }}
                            />
                            <div>
                              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                                {baseName}
                              </h4>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                Chọn kiểu sidebar cho theme này
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Theme options in group - improved cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {themes.map((preset) => {
                            const isActive = selectedThemeKey === preset.id;
                            const previewColors = preset.preview && preset.preview.length > 0
                              ? preset.preview
                              : [preset.primary];
                            const isWhiteVariant = preset.id.includes('-white');
                            const sidebarColor = isWhiteVariant ? '#FFFFFF' : preset.primary;

                            return (
                              <button
                                key={preset.id}
                                type="button"
                                onClick={() => handleThemeSelect(preset.id)}
                                className={`group relative rounded-xl border-2 p-4 text-left transition-all ${isActive || (previewThemeKey !== null && previewThemeKey === preset.id)
                                  ? "border-primary bg-primary-pastel/30 shadow-md ring-2 ring-primary/20"
                                  : "border-gray-200 hover:border-primary/40 dark:border-gray-700 dark:hover:border-primary/40"
                                  }`}
                              >
                                {/* Active indicator */}
                                {isActive && (
                                  <div className="absolute top-3 right-3">
                                    <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                                      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    </div>
                                  </div>
                                )}

                                <div className="space-y-3">
                                  {/* Header with sidebar preview */}
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                                        {isWhiteVariant ? 'Sidebar trắng' : 'Sidebar màu chủ đạo'}
                                      </p>
                                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                                        {preset.description}
                                      </p>
                                    </div>
                                    {/* Sidebar preview */}
                                    <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                                      <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                                        Sidebar
                                      </span>
                                      <div
                                        className="h-10 w-16 rounded-md border-2"
                                        style={{
                                          backgroundColor: sidebarColor,
                                          borderColor: isWhiteVariant ? '#E5E7EB' : preset.primary
                                        }}
                                      />
                                    </div>
                                  </div>

                                  {/* Color palette preview */}
                                  <div className="space-y-2">
                                    <div className="flex h-3 overflow-hidden rounded-md">
                                      {previewColors.map((color, index) => (
                                        <div
                                          key={index}
                                          className="flex-1"
                                          style={{ backgroundColor: color }}
                                        />
                                      ))}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                                      <span>Màu chủ đạo:</span>
                                      <div
                                        className="h-3 w-8 rounded border border-gray-300 dark:border-gray-600"
                                        style={{ backgroundColor: preset.primary }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Active Selection Info */}
                <div className="flex items-center gap-2 mt-2">
                  <div className="text-xs font-medium px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    Chủ đề đang chọn: <span className="font-semibold">{themePresets.find(p => p.id === selectedThemeKey)?.name || "Mặc định"}</span>
                  </div>
                  {selectedThemeKey !== "classly-red" && (
                    <button
                      type="button"
                      onClick={() => handleThemeSelect("classly-red")}
                      className="text-xs text-primary hover:underline"
                    >
                      Đặt lại mặc định
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                type="submit"
                disabled={updatingProfile}
                loading={updatingProfile}
                size="sm"
                icon={
                  <ArrowPathIcon className="h-3 w-3" />
                }
              >
                Cập nhật hồ sơ
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

