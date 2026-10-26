"use client";

import { useEffect, useCallback, useState } from "react";
import { useAuthContext } from "@/contexts/auth-context";
import { generateThemeColors } from "@/utils/theme-utils";
import { themePresets } from "@/config/presets";

/**
 * Component không hiển thị UI, chỉ làm nhiệm vụ quản lý CSS Variables cho Theme
 */
export default function ThemeManager() {
  const { user } = useAuthContext();
  const userThemeKey = user?.theme_key;
  const userMode = (user as any)?.mode;
  const [previewThemeKey, setPreviewThemeKey] = useState<string | null>(null);

  const computeSidebarColors = useCallback((primaryHex: string, presetSidebar?: any, isDarkMode: boolean = false) => {
    if (isDarkMode) {
      // Dark mode: use dark background colors, NO primary color at all
      return {
        background: "#1F2937",
        hoverBackground: "#374151",
        activeBackground: "#4B5563",
        text: "#FFFFFF",
        textHover: "#FFFFFF",
        textActive: "#FFFFFF",
      };
    }
    
    // Light mode: use preset sidebar colors if available, otherwise fallback to primary color
    // This allows themes with "-white" suffix to use white sidebar
    if (presetSidebar?.background) {
      return {
        background: presetSidebar.background,
        hoverBackground: presetSidebar.hoverBackground || presetSidebar.background,
        activeBackground: presetSidebar.activeBackground || presetSidebar.background,
        text: presetSidebar.text || "#1F2937",
        textHover: presetSidebar.textHover || presetSidebar.text || "#1F2937",
        textActive: presetSidebar.textActive || presetSidebar.text || "#1F2937",
      };
    }
    
    // Fallback: use primary color
    return {
      background: primaryHex,
      hoverBackground: primaryHex,
      activeBackground: primaryHex,
      text: "#FFFFFF",
      textHover: "#FFFFFF",
      textActive: "#FFFFFF",
    };
  }, []);

  useEffect(() => {
    // Set initial theme immediately on mount to avoid flash of wrong colors
    const root = document.documentElement;
    const getInitialTheme = () => {
      // Try to get from window first (fastest)
      const currentThemeFromWindow = typeof window !== "undefined" 
        ? (window as any).__CURRENT_THEME_KEY__ 
        : null;
      if (currentThemeFromWindow) return currentThemeFromWindow;
      
      // Try localStorage
      const fallbackThemeKey = typeof window !== "undefined" 
        ? localStorage.getItem("theme_key") 
        : null;
      if (fallbackThemeKey) return fallbackThemeKey;
      
      // Default to first preset
      return themePresets[0]?.id || "classly-red-white";
    };
    
    // Set initial theme immediately
    const initialThemeKey = getInitialTheme();
    const selectedTheme = themePresets.find(t => t.id === initialThemeKey) || themePresets[0];
    const primaryColor = selectedTheme.primary;
    const colors = generateThemeColors(primaryColor);
    
    // Set CSS variables immediately
    root.style.setProperty("--color-primary", colors.primary);
    root.style.setProperty("--color-primary-light", colors.primaryLight);
    root.style.setProperty("--color-primary-dark", colors.primaryDark);
    root.style.setProperty("--color-primary-pastel", colors.primaryPastel);
    
    if (typeof window !== "undefined" && initialThemeKey) {
      (window as any).__CURRENT_THEME_KEY__ = initialThemeKey;
    }
    
    const getMode = (): "light" | "dark" => {
      return userMode || "light";
    };

    const applyModeClass = (mode: "light" | "dark") => {
      if (mode === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };

    const applyTheme = (previewKey?: string | null, skipModeUpdate: boolean = false, explicitMode?: "light" | "dark") => {
      // Use explicit mode if provided (from event), otherwise get from getMode()
      // This ensures we use the latest mode even if user object hasn't been refetched
      const mode = explicitMode || getMode();
      // Only update mode class if not skipping (to avoid conflicts)
      if (!skipModeUpdate) {
        applyModeClass(mode);
      }

      let themeKey: string | null = null;
      
      if (previewKey) {
        themeKey = previewKey;
      } else if (userThemeKey) {
        themeKey = userThemeKey;
      } else {
        const currentThemeFromWindow = typeof window !== "undefined" 
          ? (window as any).__CURRENT_THEME_KEY__ 
          : null;
        const fallbackThemeKey = typeof window !== "undefined" ? localStorage.getItem("theme_key") : null;
        themeKey = currentThemeFromWindow || fallbackThemeKey || themePresets[0]?.id || "classly-red-white";
      }
      
      if (typeof window !== "undefined" && themeKey) {
        (window as any).__CURRENT_THEME_KEY__ = themeKey;
      }
      
      const selectedTheme = themePresets.find(t => t.id === themeKey) || themePresets[0];
      
      const primaryColor = selectedTheme.primary;
      const colors = generateThemeColors(primaryColor);

      // Set primary color variables
      root.style.setProperty("--color-primary", colors.primary);
      root.style.setProperty("--color-primary-light", colors.primaryLight);
      root.style.setProperty("--color-primary-dark", colors.primaryDark);
      root.style.setProperty("--color-primary-pastel", colors.primaryPastel);

      if (typeof window !== "undefined") {
        (window as any).__THEME_COLORS__ = colors.raw;
      }

      // Set theme color variables
      if (selectedTheme.secondary) root.style.setProperty("--color-secondary", selectedTheme.secondary);
      if (selectedTheme.accent) root.style.setProperty("--color-accent", selectedTheme.accent);
      if (selectedTheme.success) root.style.setProperty("--color-success", selectedTheme.success);
      if (selectedTheme.info) root.style.setProperty("--color-info", selectedTheme.info);
      if (selectedTheme.warning) root.style.setProperty("--color-warning", selectedTheme.warning);
      if (selectedTheme.neutral) root.style.setProperty("--color-neutral", selectedTheme.neutral);

      // Set status badge color variables
      if (selectedTheme.statusBadge) {
        const badge = selectedTheme.statusBadge;
        if (badge.active) root.style.setProperty("--status-badge-active", badge.active);
        if (badge.activeText) root.style.setProperty("--status-badge-active-text", badge.activeText);
        if (badge.pending) root.style.setProperty("--status-badge-pending", badge.pending);
        if (badge.pendingText) root.style.setProperty("--status-badge-pending-text", badge.pendingText);
        if (badge.completed) root.style.setProperty("--status-badge-completed", badge.completed);
        if (badge.completedText) root.style.setProperty("--status-badge-completed-text", badge.completedText);
        if (badge.inactive) root.style.setProperty("--status-badge-inactive", badge.inactive);
        if (badge.inactiveText) root.style.setProperty("--status-badge-inactive-text", badge.inactiveText);
        if (badge.full) root.style.setProperty("--status-badge-full", badge.full);
        if (badge.fullText) root.style.setProperty("--status-badge-full-text", badge.fullText);
        if (badge.error) root.style.setProperty("--status-badge-error", badge.error);
        if (badge.errorText) root.style.setProperty("--status-badge-error-text", badge.errorText);
        if (badge.online) root.style.setProperty("--status-badge-online", badge.online);
        if (badge.onlineText) root.style.setProperty("--status-badge-online-text", badge.onlineText);
        if (badge.offline) root.style.setProperty("--status-badge-offline", badge.offline);
        if (badge.offlineText) root.style.setProperty("--status-badge-offline-text", badge.offlineText);
      }

      // Sidebar colors: light mode uses primary, dark mode uses dark colors
      const lightSidebarColors = computeSidebarColors(primaryColor, selectedTheme.sidebar, false);
      const darkSidebarColors = computeSidebarColors(primaryColor, selectedTheme.sidebar, true);
      
      // Set light mode sidebar colors
      root.style.setProperty("--sidebar-bg", lightSidebarColors.background);
      root.style.setProperty("--sidebar-text", lightSidebarColors.text);
      root.style.setProperty("--sidebar-text-hover", lightSidebarColors.textHover);
      root.style.setProperty("--sidebar-text-active", lightSidebarColors.textActive);
      root.style.setProperty("--sidebar-hover-bg", lightSidebarColors.hoverBackground);
      root.style.setProperty("--sidebar-active-bg", lightSidebarColors.activeBackground);

      // Set dark mode sidebar colors
      root.style.setProperty("--sidebar-bg-dark", darkSidebarColors.background);
      root.style.setProperty("--sidebar-text-dark", darkSidebarColors.text);
      root.style.setProperty("--sidebar-text-hover-dark", darkSidebarColors.textHover);
      root.style.setProperty("--sidebar-text-active-dark", darkSidebarColors.textActive);
      root.style.setProperty("--sidebar-hover-bg-dark", darkSidebarColors.hoverBackground);
      root.style.setProperty("--sidebar-active-bg-dark", darkSidebarColors.activeBackground);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent('theme-colors-updated'));
      }
    };

    const themeToApply = previewThemeKey || userThemeKey || (typeof window !== "undefined" ? (window as any).__CURRENT_THEME_KEY__ : null);
    applyTheme(themeToApply || null);

    if (typeof window !== "undefined") {
      const handleModeUpdated = (e?: Event) => {
        const customEvent = e as CustomEvent<{ mode: "light" | "dark" }> | undefined;
        const eventMode = customEvent?.detail?.mode;
        const latestMode = eventMode || userMode || "light";
        applyTheme(previewThemeKey, false, latestMode);
      };
      
      const handleThemePreview = (e: Event) => {
        const customEvent = e as CustomEvent<{ themeKey: string | null }>;
        const newPreviewKey = customEvent.detail.themeKey;
        
        if (newPreviewKey === null) {
          setPreviewThemeKey(null);
          applyTheme(null, true);
          return;
        }
        
        if (newPreviewKey !== previewThemeKey) {
          setPreviewThemeKey(newPreviewKey);
        }
        applyTheme(newPreviewKey, true);
      };
      
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleMediaChange = () => {
        applyTheme(previewThemeKey, false);
      };

      window.addEventListener('mode-updated', handleModeUpdated);
      window.addEventListener('theme-preview', handleThemePreview);
      mediaQuery.addEventListener('change', handleMediaChange);

      return () => {
        window.removeEventListener('mode-updated', handleModeUpdated);
        window.removeEventListener('theme-preview', handleThemePreview);
        mediaQuery.removeEventListener('change', handleMediaChange);
      };
    }
  }, [userThemeKey, userMode, computeSidebarColors, previewThemeKey]);

  return null;
}

