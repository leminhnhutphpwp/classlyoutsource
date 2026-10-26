/**
 * Color Configuration - Bộ màu dùng chung cho toàn bộ ứng dụng
 * Chỉ cần sửa ở đây để thay đổi màu sắc cho toàn bộ hệ thống
 */

export const colors = {
  // Màu chính từ hình ảnh
  primary: {
    DEFAULT: "#EF4444", // Coral/Reddish-orange - Màu chính
    light: "#F87171",   // Lighter coral/pink
    dark: "#DC2626",    // Darker shade for hover states
    pastel: "#FFE4E6",  // Very light pastel pink
  },
  
  // Màu tối
  dark: {
    DEFAULT: "#1F2937", // Dark navy/almost black
    light: "#374151",   // Lighter dark
    lighter: "#4B5563", // Even lighter
  },
  
  // Màu trắng
  white: "#FFFFFF",
  
  // Màu semantic (dựa trên màu chính)
  error: {
    DEFAULT: "#EF4444", // Sử dụng primary color
    light: "#F87171",
    pastel: "#FFE4E6",
    dark: "#DC2626",
  },
  
  // Màu nền và text
  background: {
    light: "#FFFFFF",
    dark: "#1F2937",
    pastel: "#FFE4E6",
  },
  
  text: {
    primary: "#1F2937",
    secondary: "#374151",
    light: "#6B7280",
    onPrimary: "#FFFFFF", // Text trên nền primary
  },
} as const;

/**
 * Export màu để sử dụng trong JavaScript/TypeScript code
 */
export const colorValues = {
  primary: colors.primary.DEFAULT,
  primaryLight: colors.primary.light,
  primaryDark: colors.primary.dark,
  primaryPastel: colors.primary.pastel,
  dark: colors.dark.DEFAULT,
  darkLight: colors.dark.light,
  white: colors.white,
  error: colors.error.DEFAULT,
  errorLight: colors.error.light,
  errorPastel: colors.error.pastel,
} as const;

/**
 * Type definitions cho colors
 */
export type ColorKey = keyof typeof colors;
export type PrimaryColorKey = keyof typeof colors.primary;
export type DarkColorKey = keyof typeof colors.dark;

