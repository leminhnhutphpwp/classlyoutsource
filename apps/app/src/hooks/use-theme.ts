"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuthContext } from "@/contexts/auth-context";
import { colorValues } from "@/config/colors";

export type ThemeColorSet = {
  primary: string;
  primaryLight: string;
  primaryDark: string;
};

/**
 * Đọc màu theme từ window.__THEME_COLORS__ (synchronous)
 */
function getThemeColorsFromWindow(): ThemeColorSet | null {
  if (typeof window === "undefined") return null;
  const themeColors = (window as any).__THEME_COLORS__;
  if (themeColors) {
    return {
      primary: themeColors.primary || colorValues.primary,
      primaryLight: themeColors.primaryLight || colorValues.primaryLight,
      primaryDark: themeColors.primaryDark || colorValues.primaryDark,
    };
  }
  return null;
}

/**
 * Hook dùng cho chart / component cần màu HEX theo theme hiện tại.
 * - Đọc từ window.__THEME_COLORS__ do ThemeManager set.
 * - Re-render khi theme_key của user thay đổi.
 * - Đọc màu ngay từ đầu (synchronous) để tránh flash màu mặc định.
 */
export function useThemeColors(): ThemeColorSet {
  const { user } = useAuthContext();
  
  // Đọc màu ngay từ đầu (synchronous) để tránh flash màu mặc định
  const initialColors = useMemo(() => {
    const themeColors = getThemeColorsFromWindow();
    return themeColors || {
      primary: colorValues.primary,
      primaryLight: colorValues.primaryLight,
      primaryDark: colorValues.primaryDark,
    };
  }, []);

  const [colors, setColors] = useState<ThemeColorSet>(initialColors);

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // Đọc theme_key từ user hoặc localStorage để giảm flash màu
    const fallbackThemeKey = localStorage.getItem("theme_key");
    const _themeKey = user?.theme_key || fallbackThemeKey || "classly-red-white";
    const storedColors = getThemeColorsFromWindow();

    // Nếu đã có màu trên window, dùng luôn
    if (storedColors) {
      setColors(storedColors);
      return;
    }

    // Nếu chưa có, fallback màu mặc định (được ThemeManager set theo themeKey)
    setColors({
      primary: colorValues.primary,
      primaryLight: colorValues.primaryLight,
      primaryDark: colorValues.primaryDark,
    });
  }, [user?.theme_key]);

  // Lắng nghe sự kiện theme thay đổi từ ThemeManager
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleThemeChange = () => {
      const themeColors = getThemeColorsFromWindow();
      if (themeColors) {
        setColors(themeColors);
      }
    };

    // Lắng nghe custom event nếu ThemeManager dispatch
    window.addEventListener('theme-colors-updated', handleThemeChange);
    
    // Kiểm tra ngay khi mount để đảm bảo có màu mới nhất
    handleThemeChange();

    return () => {
      window.removeEventListener('theme-colors-updated', handleThemeChange);
    };
  }, [user?.theme_key]);

  return colors;
}


