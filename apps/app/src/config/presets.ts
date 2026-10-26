/**
 * Preset Themes - Các bộ màu mẫu cho giáo viên chọn
 */

export interface ThemePreset {
  id: string;
  name: string;
  primary: string;
  description: string;
  // Các màu semantic cho theme
  secondary?: string;
  accent?: string;
  success?: string;
  info?: string;
  warning?: string;
  neutral?: string;
  preview?: string[]; // Các màu preview để hiển thị mini-palette
  // Sidebar colors
  sidebar?: {
    background?: string;
    text?: string;
    textHover?: string;
    textActive?: string;
    hoverBackground?: string;
    activeBackground?: string;
  };
  // Status badge colors - màu cho các badge trạng thái
  // Quy ước: Active -> xanh (success), Full/Warning -> đỏ/vàng (error/warning), Inactive -> gray
  statusBadge?: {
    active?: string;        // Màu nền cho trạng thái active/published/hoạt động (xanh success)
    activeText?: string;    // Màu chữ cho trạng thái active/published/hoạt động
    pending?: string;       // Màu nền cho trạng thái pending/draft (vàng warning)
    pendingText?: string;   // Màu chữ cho trạng thái pending/draft
    completed?: string;     // Màu nền cho trạng thái completed (xanh nhạt)
    completedText?: string; // Màu chữ cho trạng thái completed
    inactive?: string;      // Màu nền cho trạng thái inactive/closed (gray)
    inactiveText?: string; // Màu chữ cho trạng thái inactive/closed
    full?: string;         // Màu nền cho trạng thái đầy/cảnh báo (đỏ error)
    fullText?: string;     // Màu chữ cho trạng thái đầy/cảnh báo
    error?: string;         // Màu nền cho trạng thái error/dropped (đỏ)
    errorText?: string;     // Màu chữ cho trạng thái error/dropped
    online?: string;        // Màu nền cho trạng thái online (xanh dương info)
    onlineText?: string;    // Màu chữ cho trạng thái online
    offline?: string;       // Màu nền cho trạng thái offline (cam/vàng warning)
    offlineText?: string;   // Màu chữ cho trạng thái offline
  };
}

export const themePresets: ThemePreset[] = [
  {
    id: "classly-red-white",
    name: "Classly Red (Sidebar trắng) (Mặc định)",
    primary: "#EF4444",
    description: "Màu đỏ san hô với sidebar trắng.",
    secondary: "#3B82F6",
    accent: "#F59E0B",
    success: "#10B981",
    info: "#3B82F6",
    warning: "#F97316",
    neutral: "#6B7280",
    preview: ["#111827", "#4B5563", "#EF4444", "#F59E0B"],
    sidebar: {
      background: "#FFFFFF",
      text: "#1F2937",
      textHover: "#EF4444",
      textActive: "#EF4444",
      hoverBackground: "#F9FAFB",
      activeBackground: "#F3F4F6",
    },
    statusBadge: {
      active: "#D1FAE5",        // Green pastel (success) - Hoạt động
      activeText: "#047857",    // Dark green
      pending: "#FEF3C7",       // Yellow pastel (warning) - Chờ xử lý
      pendingText: "#92400E",   // Dark amber
      completed: "#ECFDF5",     // Very light green - Hoàn thành
      completedText: "#065F46",  // Darker green
      inactive: "#F3F4F6",      // Gray - Tạm dừng/Đóng
      inactiveText: "#6B7280",  // Gray text
      full: "#FEE2E2",          // Red pastel (error) - Đầy/Cảnh báo
      fullText: "#DC2626",      // Dark red
      error: "#FEE2E2",         // Red pastel - Lỗi/Đã nghỉ
      errorText: "#DC2626",     // Dark red
      online: "#DBEAFE",        // Blue pastel (info) - Online
      onlineText: "#1E40AF",    // Dark blue
      offline: "#FEF3C7",       // Yellow pastel (warning) - Offline
      offlineText: "#92400E",   // Dark amber
    },
  },
  {
    id: "classly-red",
    name: "Classly Red",
    primary: "#EF4444",
    description: "Màu đỏ san hô năng động, nhiệt huyết.",
    secondary: "#3B82F6",
    accent: "#F59E0B",
    success: "#10B981",
    info: "#3B82F6",
    warning: "#F97316",
    neutral: "#6B7280",
    preview: ["#111827", "#4B5563", "#EF4444", "#F59E0B"],
    sidebar: {
      background: "#DC2626", // Darker red, less bright
      text: "#FFFFFF",
      textHover: "#FFFFFF",
      textActive: "#FFFFFF",
      hoverBackground: "#B91C1C",
      activeBackground: "#991B1B",
    },
    statusBadge: {
      active: "#D1FAE5",        // Green pastel (success) - Hoạt động
      activeText: "#047857",    // Dark green
      pending: "#FEF3C7",       // Yellow pastel (warning) - Chờ xử lý
      pendingText: "#92400E",   // Dark amber
      completed: "#ECFDF5",     // Very light green - Hoàn thành
      completedText: "#065F46",  // Darker green
      inactive: "#F3F4F6",      // Gray - Tạm dừng/Đóng
      inactiveText: "#6B7280",  // Gray text
      full: "#FEE2E2",          // Red pastel (error) - Đầy/Cảnh báo
      fullText: "#DC2626",      // Dark red
      error: "#FEE2E2",         // Red pastel - Lỗi/Đã nghỉ
      errorText: "#DC2626",     // Dark red
      online: "#DBEAFE",        // Blue pastel (info) - Online
      onlineText: "#1E40AF",    // Dark blue
      offline: "#FEF3C7",       // Yellow pastel (warning) - Offline
      offlineText: "#92400E",   // Dark amber
    },
  },
  {
    id: "classly-blue",
    name: "Classly Blue",
    primary: "#3B82F6",
    description: "Màu xanh dương tin cậy, chuyên nghiệp.",
    secondary: "#0EA5E9",
    accent: "#F97316",
    success: "#22C55E",
    info: "#3B82F6",
    warning: "#FACC15",
    neutral: "#64748B",
    preview: ["#111827", "#1D4ED8", "#3B82F6", "#22C55E"],
    sidebar: {
      background: "#2563EB", // Darker blue, less bright
      text: "#FFFFFF",
      textHover: "#FFFFFF",
      textActive: "#FFFFFF",
      hoverBackground: "#1D4ED8",
      activeBackground: "#1E40AF",
    },
    statusBadge: {
      active: "#D1FAE5",        // Green pastel (success) - Hoạt động
      activeText: "#047857",    // Dark green
      pending: "#FEF3C7",       // Yellow pastel (warning) - Chờ xử lý
      pendingText: "#92400E",   // Dark amber
      completed: "#ECFDF5",     // Very light green - Hoàn thành
      completedText: "#065F46",  // Darker green
      inactive: "#F3F4F6",      // Gray - Tạm dừng/Đóng
      inactiveText: "#6B7280",  // Gray text
      full: "#FEE2E2",          // Red pastel (error) - Đầy/Cảnh báo
      fullText: "#DC2626",      // Dark red
      error: "#FEE2E2",         // Red pastel - Lỗi/Đã nghỉ
      errorText: "#DC2626",     // Dark red
      online: "#DBEAFE",        // Blue pastel (info) - Online
      onlineText: "#1E40AF",    // Dark blue
      offline: "#FEF3C7",       // Yellow pastel (warning) - Offline
      offlineText: "#92400E",   // Dark amber
    },
  },
  {
    id: "emerald",
    name: "Emerald Green",
    primary: "#10B981",
    description: "Màu xanh lá tươi mới, giáo dục.",
    secondary: "#22C55E",
    accent: "#FACC15",
    success: "#10B981",
    info: "#0EA5E9",
    warning: "#F59E0B",
    neutral: "#4B5563",
    preview: ["#022C22", "#047857", "#10B981", "#A7F3D0"],
    sidebar: {
      background: "#059669", // Darker green, less bright
      text: "#FFFFFF",
      textHover: "#FFFFFF",
      textActive: "#FFFFFF",
      hoverBackground: "#047857",
      activeBackground: "#065F46",
    },
    statusBadge: {
      active: "#D1FAE5",        // Green pastel (success) - Hoạt động
      activeText: "#047857",    // Dark green
      pending: "#FEF3C7",       // Yellow pastel (warning) - Chờ xử lý
      pendingText: "#92400E",   // Dark amber
      completed: "#ECFDF5",     // Very light green - Hoàn thành
      completedText: "#065F46", // Darker green
      inactive: "#F3F4F6",      // Gray - Tạm dừng/Đóng
      inactiveText: "#6B7280",  // Gray text
      full: "#FEE2E2",          // Red pastel (error) - Đầy/Cảnh báo
      fullText: "#DC2626",      // Dark red
      error: "#FEE2E2",         // Red pastel - Lỗi/Đã nghỉ
      errorText: "#DC2626",     // Dark red
      online: "#DBEAFE",        // Blue pastel (info) - Online
      onlineText: "#1E40AF",    // Dark blue
      offline: "#FEF3C7",       // Yellow pastel (warning) - Offline
      offlineText: "#92400E",   // Dark amber
    },
  },
  {
    id: "indigo",
    name: "Indigo Night",
    primary: "#6366F1",
    description: "Màu tím indigo hiện đại, sáng tạo.",
    secondary: "#8B5CF6",
    accent: "#F97316",
    success: "#22C55E",
    info: "#3B82F6",
    warning: "#F59E0B",
    neutral: "#475569",
    preview: ["#020617", "#312E81", "#6366F1", "#A855F7"],
    sidebar: {
      background: "#4F46E5", // Darker indigo, less bright
      text: "#FFFFFF",
      textHover: "#FFFFFF",
      textActive: "#FFFFFF",
      hoverBackground: "#4338CA",
      activeBackground: "#3730A3",
    },
    statusBadge: {
      active: "#D1FAE5",        // Green pastel (success) - Hoạt động
      activeText: "#047857",    // Dark green
      pending: "#FEF3C7",       // Yellow pastel (warning) - Chờ xử lý
      pendingText: "#92400E",   // Dark amber
      completed: "#ECFDF5",     // Very light green - Hoàn thành
      completedText: "#065F46", // Darker green
      inactive: "#F3F4F6",      // Gray - Tạm dừng/Đóng
      inactiveText: "#6B7280",  // Gray text
      full: "#FEE2E2",          // Red pastel (error) - Đầy/Cảnh báo
      fullText: "#DC2626",      // Dark red
      error: "#FEE2E2",         // Red pastel - Lỗi/Đã nghỉ
      errorText: "#DC2626",     // Dark red
      online: "#DBEAFE",        // Blue pastel (info) - Online
      onlineText: "#1E40AF",    // Dark blue
      offline: "#FEF3C7",       // Yellow pastel (warning) - Offline
      offlineText: "#92400E",   // Dark amber
    },
  },
  {
    id: "amber",
    name: "Amber Warm",
    primary: "#F59E0B",
    description: "Màu cam vàng ấm áp, gần gũi.",
    secondary: "#FB923C",
    accent: "#F97316",
    success: "#22C55E",
    info: "#3B82F6",
    warning: "#EAB308",
    neutral: "#78350F",
    preview: ["#451A03", "#92400E", "#F59E0B", "#FCD34D"],
    sidebar: {
      background: "#D97706", // Darker amber, less bright
      text: "#FFFFFF",
      textHover: "#FFFFFF",
      textActive: "#FFFFFF",
      hoverBackground: "#B45309",
      activeBackground: "#92400E",
    },
    statusBadge: {
      active: "#D1FAE5",        // Green pastel (success) - Hoạt động
      activeText: "#047857",    // Dark green
      pending: "#FEF3C7",       // Yellow pastel (warning) - Chờ xử lý
      pendingText: "#92400E",   // Dark amber
      completed: "#ECFDF5",     // Very light green - Hoàn thành
      completedText: "#065F46", // Darker green
      inactive: "#F3F4F6",      // Gray - Tạm dừng/Đóng
      inactiveText: "#6B7280",  // Gray text
      full: "#FEE2E2",          // Red pastel (error) - Đầy/Cảnh báo
      fullText: "#DC2626",      // Dark red
      error: "#FEE2E2",         // Red pastel - Lỗi/Đã nghỉ
      errorText: "#DC2626",     // Dark red
      online: "#DBEAFE",        // Blue pastel (info) - Online
      onlineText: "#1E40AF",    // Dark blue
      offline: "#FEF3C7",       // Yellow pastel (warning) - Offline
      offlineText: "#92400E",   // Dark amber
    },
  },
  {
    id: "rose",
    name: "Rose Pink",
    primary: "#F43F5E",
    description: "Màu hồng rose nhẹ nhàng, tinh tế.",
    secondary: "#EC4899",
    accent: "#F97316",
    success: "#22C55E",
    info: "#3B82F6",
    warning: "#EAB308",
    neutral: "#4C0519",
    preview: ["#4C0519", "#BE123C", "#F43F5E", "#FB7185"],
    sidebar: {
      background: "#E11D48", // Darker rose, less bright
      text: "#FFFFFF",
      textHover: "#FFFFFF",
      textActive: "#FFFFFF",
      hoverBackground: "#BE123C",
      activeBackground: "#9F1239",
    },
    statusBadge: {
      active: "#D1FAE5",        // Green pastel (success) - Hoạt động
      activeText: "#047857",    // Dark green
      pending: "#FEF3C7",       // Yellow pastel (warning) - Chờ xử lý
      pendingText: "#92400E",   // Dark amber
      completed: "#ECFDF5",     // Very light green - Hoàn thành
      completedText: "#065F46", // Darker green
      inactive: "#F3F4F6",      // Gray - Tạm dừng/Đóng
      inactiveText: "#6B7280",  // Gray text
      full: "#FEE2E2",          // Red pastel (error) - Đầy/Cảnh báo
      fullText: "#DC2626",      // Dark red
      error: "#FEE2E2",         // Red pastel - Lỗi/Đã nghỉ
      errorText: "#DC2626",     // Dark red
      online: "#DBEAFE",        // Blue pastel (info) - Online
      onlineText: "#1E40AF",    // Dark blue
      offline: "#FEF3C7",       // Yellow pastel (warning) - Offline
      offlineText: "#92400E",   // Dark amber
    },
  },
  {
    id: "violet",
    name: "Violet Dream",
    primary: "#8B5CF6",
    description: "Màu tím violet mộng mơ, nghệ thuật.",
    secondary: "#6366F1",
    accent: "#F97316",
    success: "#22C55E",
    info: "#3B82F6",
    warning: "#FACC15",
    neutral: "#312E81",
    preview: ["#2E1065", "#6D28D9", "#8B5CF6", "#C4B5FD"],
    sidebar: {
      background: "#7C3AED", // Darker violet, less bright
      text: "#FFFFFF",
      textHover: "#FFFFFF",
      textActive: "#FFFFFF",
      hoverBackground: "#6D28D9",
      activeBackground: "#5B21B6",
    },
    statusBadge: {
      active: "#D1FAE5",        // Green pastel (success) - Hoạt động
      activeText: "#047857",    // Dark green
      pending: "#FEF3C7",       // Yellow pastel (warning) - Chờ xử lý
      pendingText: "#92400E",   // Dark amber
      completed: "#ECFDF5",     // Very light green - Hoàn thành
      completedText: "#065F46", // Darker green
      inactive: "#F3F4F6",      // Gray - Tạm dừng/Đóng
      inactiveText: "#6B7280",  // Gray text
      full: "#FEE2E2",          // Red pastel (error) - Đầy/Cảnh báo
      fullText: "#DC2626",      // Dark red
      error: "#FEE2E2",         // Red pastel - Lỗi/Đã nghỉ
      errorText: "#DC2626",     // Dark red
      online: "#DBEAFE",        // Blue pastel (info) - Online
      onlineText: "#1E40AF",    // Dark blue
      offline: "#FEF3C7",       // Yellow pastel (warning) - Offline
      offlineText: "#92400E",   // Dark amber
    },
  },
  {
    id: "cyan",
    name: "Cyan Ocean",
    primary: "#06B6D4",
    description: "Màu xanh cyan thanh khiết, rộng mở.",
    secondary: "#0EA5E9",
    accent: "#F97316",
    success: "#22C55E",
    info: "#06B6D4",
    warning: "#FACC15",
    neutral: "#0F172A",
    preview: ["#083344", "#0E7490", "#06B6D4", "#67E8F9"],
    sidebar: {
      background: "#0891B2", // Darker cyan, less bright
      text: "#FFFFFF",
      textHover: "#FFFFFF",
      textActive: "#FFFFFF",
      hoverBackground: "#0E7490",
      activeBackground: "#155E75",
    },
    statusBadge: {
      active: "#D1FAE5",        // Green pastel (success) - Hoạt động
      activeText: "#047857",    // Dark green
      pending: "#FEF3C7",       // Yellow pastel (warning) - Chờ xử lý
      pendingText: "#92400E",   // Dark amber
      completed: "#ECFDF5",     // Very light green - Hoàn thành
      completedText: "#065F46", // Darker green
      inactive: "#F3F4F6",      // Gray - Tạm dừng/Đóng
      inactiveText: "#6B7280",  // Gray text
      full: "#FEE2E2",          // Red pastel (error) - Đầy/Cảnh báo
      fullText: "#DC2626",      // Dark red
      error: "#FEE2E2",         // Red pastel - Lỗi/Đã nghỉ
      errorText: "#DC2626",     // Dark red
      online: "#DBEAFE",        // Blue pastel (info) - Online
      onlineText: "#1E40AF",    // Dark blue
      offline: "#FEF3C7",       // Yellow pastel (warning) - Offline
      offlineText: "#92400E",   // Dark amber
    },
  },
  // White sidebar variants

  {
    id: "classly-blue-white",
    name: "Classly Blue (Sidebar trắng)",
    primary: "#3B82F6",
    description: "Màu xanh dương với sidebar trắng.",
    secondary: "#0EA5E9",
    accent: "#F97316",
    success: "#22C55E",
    info: "#3B82F6",
    warning: "#FACC15",
    neutral: "#64748B",
    preview: ["#111827", "#1D4ED8", "#3B82F6", "#22C55E"],
    sidebar: {
      background: "#FFFFFF",
      text: "#1F2937",
      textHover: "#3B82F6",
      textActive: "#3B82F6",
      hoverBackground: "#F9FAFB",
      activeBackground: "#F3F4F6",
    },
    statusBadge: {
      active: "#D1FAE5",        // Green pastel (success) - Hoạt động
      activeText: "#047857",    // Dark green
      pending: "#FEF3C7",       // Yellow pastel (warning) - Chờ xử lý
      pendingText: "#92400E",   // Dark amber
      completed: "#ECFDF5",     // Very light green - Hoàn thành
      completedText: "#065F46",  // Darker green
      inactive: "#F3F4F6",      // Gray - Tạm dừng/Đóng
      inactiveText: "#6B7280",  // Gray text
      full: "#FEE2E2",          // Red pastel (error) - Đầy/Cảnh báo
      fullText: "#DC2626",      // Dark red
      error: "#FEE2E2",         // Red pastel - Lỗi/Đã nghỉ
      errorText: "#DC2626",     // Dark red
      online: "#DBEAFE",        // Blue pastel (info) - Online
      onlineText: "#1E40AF",    // Dark blue
      offline: "#FEF3C7",       // Yellow pastel (warning) - Offline
      offlineText: "#92400E",   // Dark amber
    },
  },
  {
    id: "emerald-white",
    name: "Emerald Green (Sidebar trắng)",
    primary: "#10B981",
    description: "Màu xanh lá với sidebar trắng.",
    secondary: "#22C55E",
    accent: "#FACC15",
    success: "#10B981",
    info: "#0EA5E9",
    warning: "#F59E0B",
    neutral: "#4B5563",
    preview: ["#022C22", "#047857", "#10B981", "#A7F3D0"],
    sidebar: {
      background: "#FFFFFF",
      text: "#1F2937",
      textHover: "#10B981",
      textActive: "#10B981",
      hoverBackground: "#F9FAFB",
      activeBackground: "#F3F4F6",
    },
    statusBadge: {
      active: "#D1FAE5",        // Green pastel (success) - Hoạt động
      activeText: "#047857",    // Dark green
      pending: "#FEF3C7",       // Yellow pastel (warning) - Chờ xử lý
      pendingText: "#92400E",   // Dark amber
      completed: "#ECFDF5",     // Very light green - Hoàn thành
      completedText: "#065F46", // Darker green
      inactive: "#F3F4F6",      // Gray - Tạm dừng/Đóng
      inactiveText: "#6B7280",  // Gray text
      full: "#FEE2E2",          // Red pastel (error) - Đầy/Cảnh báo
      fullText: "#DC2626",      // Dark red
      error: "#FEE2E2",         // Red pastel - Lỗi/Đã nghỉ
      errorText: "#DC2626",     // Dark red
      online: "#DBEAFE",        // Blue pastel (info) - Online
      onlineText: "#1E40AF",    // Dark blue
      offline: "#FEF3C7",       // Yellow pastel (warning) - Offline
      offlineText: "#92400E",   // Dark amber
    },
  },
  {
    id: "indigo-white",
    name: "Indigo Night (Sidebar trắng)",
    primary: "#6366F1",
    description: "Màu tím indigo với sidebar trắng.",
    secondary: "#8B5CF6",
    accent: "#F97316",
    success: "#22C55E",
    info: "#3B82F6",
    warning: "#F59E0B",
    neutral: "#475569",
    preview: ["#020617", "#312E81", "#6366F1", "#A855F7"],
    sidebar: {
      background: "#FFFFFF",
      text: "#1F2937",
      textHover: "#6366F1",
      textActive: "#6366F1",
      hoverBackground: "#F9FAFB",
      activeBackground: "#F3F4F6",
    },
    statusBadge: {
      active: "#D1FAE5",        // Green pastel (success) - Hoạt động
      activeText: "#047857",    // Dark green
      pending: "#FEF3C7",       // Yellow pastel (warning) - Chờ xử lý
      pendingText: "#92400E",   // Dark amber
      completed: "#ECFDF5",     // Very light green - Hoàn thành
      completedText: "#065F46", // Darker green
      inactive: "#F3F4F6",      // Gray - Tạm dừng/Đóng
      inactiveText: "#6B7280",  // Gray text
      full: "#FEE2E2",          // Red pastel (error) - Đầy/Cảnh báo
      fullText: "#DC2626",      // Dark red
      error: "#FEE2E2",         // Red pastel - Lỗi/Đã nghỉ
      errorText: "#DC2626",     // Dark red
      online: "#DBEAFE",        // Blue pastel (info) - Online
      onlineText: "#1E40AF",    // Dark blue
      offline: "#FEF3C7",       // Yellow pastel (warning) - Offline
      offlineText: "#92400E",   // Dark amber
    },
  },
  {
    id: "amber-white",
    name: "Amber Warm (Sidebar trắng)",
    primary: "#F59E0B",
    description: "Màu cam vàng với sidebar trắng.",
    secondary: "#FB923C",
    accent: "#F97316",
    success: "#22C55E",
    info: "#3B82F6",
    warning: "#EAB308",
    neutral: "#78350F",
    preview: ["#451A03", "#92400E", "#F59E0B", "#FCD34D"],
    sidebar: {
      background: "#FFFFFF",
      text: "#1F2937",
      textHover: "#F59E0B",
      textActive: "#F59E0B",
      hoverBackground: "#F9FAFB",
      activeBackground: "#F3F4F6",
    },
    statusBadge: {
      active: "#D1FAE5",        // Green pastel (success) - Hoạt động
      activeText: "#047857",    // Dark green
      pending: "#FEF3C7",       // Yellow pastel (warning) - Chờ xử lý
      pendingText: "#92400E",   // Dark amber
      completed: "#ECFDF5",     // Very light green - Hoàn thành
      completedText: "#065F46", // Darker green
      inactive: "#F3F4F6",      // Gray - Tạm dừng/Đóng
      inactiveText: "#6B7280",  // Gray text
      full: "#FEE2E2",          // Red pastel (error) - Đầy/Cảnh báo
      fullText: "#DC2626",      // Dark red
      error: "#FEE2E2",         // Red pastel - Lỗi/Đã nghỉ
      errorText: "#DC2626",     // Dark red
      online: "#DBEAFE",        // Blue pastel (info) - Online
      onlineText: "#1E40AF",    // Dark blue
      offline: "#FEF3C7",       // Yellow pastel (warning) - Offline
      offlineText: "#92400E",   // Dark amber
    },
  },
  {
    id: "rose-white",
    name: "Rose Pink (Sidebar trắng)",
    primary: "#F43F5E",
    description: "Màu hồng rose với sidebar trắng.",
    secondary: "#EC4899",
    accent: "#F97316",
    success: "#22C55E",
    info: "#3B82F6",
    warning: "#EAB308",
    neutral: "#4C0519",
    preview: ["#4C0519", "#BE123C", "#F43F5E", "#FB7185"],
    sidebar: {
      background: "#FFFFFF",
      text: "#1F2937",
      textHover: "#F43F5E",
      textActive: "#F43F5E",
      hoverBackground: "#F9FAFB",
      activeBackground: "#F3F4F6",
    },
    statusBadge: {
      active: "#D1FAE5",        // Green pastel (success) - Hoạt động
      activeText: "#047857",    // Dark green
      pending: "#FEF3C7",       // Yellow pastel (warning) - Chờ xử lý
      pendingText: "#92400E",   // Dark amber
      completed: "#ECFDF5",     // Very light green - Hoàn thành
      completedText: "#065F46", // Darker green
      inactive: "#F3F4F6",      // Gray - Tạm dừng/Đóng
      inactiveText: "#6B7280",  // Gray text
      full: "#FEE2E2",          // Red pastel (error) - Đầy/Cảnh báo
      fullText: "#DC2626",      // Dark red
      error: "#FEE2E2",         // Red pastel - Lỗi/Đã nghỉ
      errorText: "#DC2626",     // Dark red
      online: "#DBEAFE",        // Blue pastel (info) - Online
      onlineText: "#1E40AF",    // Dark blue
      offline: "#FEF3C7",       // Yellow pastel (warning) - Offline
      offlineText: "#92400E",   // Dark amber
    },
  },
  {
    id: "violet-white",
    name: "Violet Dream (Sidebar trắng)",
    primary: "#8B5CF6",
    description: "Màu tím violet với sidebar trắng.",
    secondary: "#6366F1",
    accent: "#F97316",
    success: "#22C55E",
    info: "#3B82F6",
    warning: "#FACC15",
    neutral: "#312E81",
    preview: ["#2E1065", "#6D28D9", "#8B5CF6", "#C4B5FD"],
    sidebar: {
      background: "#FFFFFF",
      text: "#1F2937",
      textHover: "#8B5CF6",
      textActive: "#8B5CF6",
      hoverBackground: "#F9FAFB",
      activeBackground: "#F3F4F6",
    },
    statusBadge: {
      active: "#D1FAE5",        // Green pastel (success) - Hoạt động
      activeText: "#047857",    // Dark green
      pending: "#FEF3C7",       // Yellow pastel (warning) - Chờ xử lý
      pendingText: "#92400E",   // Dark amber
      completed: "#ECFDF5",     // Very light green - Hoàn thành
      completedText: "#065F46", // Darker green
      inactive: "#F3F4F6",      // Gray - Tạm dừng/Đóng
      inactiveText: "#6B7280",  // Gray text
      full: "#FEE2E2",          // Red pastel (error) - Đầy/Cảnh báo
      fullText: "#DC2626",      // Dark red
      error: "#FEE2E2",         // Red pastel - Lỗi/Đã nghỉ
      errorText: "#DC2626",     // Dark red
      online: "#DBEAFE",        // Blue pastel (info) - Online
      onlineText: "#1E40AF",    // Dark blue
      offline: "#FEF3C7",       // Yellow pastel (warning) - Offline
      offlineText: "#92400E",   // Dark amber
    },
  },
  {
    id: "cyan-white",
    name: "Cyan Ocean (Sidebar trắng)",
    primary: "#06B6D4",
    description: "Màu xanh cyan với sidebar trắng.",
    secondary: "#0EA5E9",
    accent: "#F97316",
    success: "#22C55E",
    info: "#06B6D4",
    warning: "#FACC15",
    neutral: "#0F172A",
    preview: ["#083344", "#0E7490", "#06B6D4", "#67E8F9"],
    sidebar: {
      background: "#FFFFFF",
      text: "#1F2937",
      textHover: "#06B6D4",
      textActive: "#06B6D4",
      hoverBackground: "#F9FAFB",
      activeBackground: "#F3F4F6",
    },
    statusBadge: {
      active: "#D1FAE5",        // Green pastel (success) - Hoạt động
      activeText: "#047857",    // Dark green
      pending: "#FEF3C7",       // Yellow pastel (warning) - Chờ xử lý
      pendingText: "#92400E",   // Dark amber
      completed: "#ECFDF5",     // Very light green - Hoàn thành
      completedText: "#065F46", // Darker green
      inactive: "#F3F4F6",      // Gray - Tạm dừng/Đóng
      inactiveText: "#6B7280",  // Gray text
      full: "#FEE2E2",          // Red pastel (error) - Đầy/Cảnh báo
      fullText: "#DC2626",      // Dark red
      error: "#FEE2E2",         // Red pastel - Lỗi/Đã nghỉ
      errorText: "#DC2626",     // Dark red
      online: "#DBEAFE",        // Blue pastel (info) - Online
      onlineText: "#1E40AF",    // Dark blue
      offline: "#FEF3C7",       // Yellow pastel (warning) - Offline
      offlineText: "#92400E",   // Dark amber
    },
  },
];

/**
 * Group themes by base theme (without -white suffix)
 */
export const groupThemesByBase = () => {
  const groups: Record<string, ThemePreset[]> = {};
  
  themePresets.forEach(theme => {
    const baseId = theme.id.replace('-white', '');
    if (!groups[baseId]) {
      groups[baseId] = [];
    }
    groups[baseId].push(theme);
  });
  
  return groups;
};

/**
 * Get base theme ID from theme ID (removes -white suffix)
 */
export const getBaseThemeId = (themeId: string): string => {
  return themeId.replace('-white', '');
};

/**
 * Helper để tính toán các màu liên quan (light, dark, pastel) từ màu chính
 */
export const getThemeColors = (primaryHex: string) => {
  // Đơn giản hóa: trong thực tế có thể dùng thư viện như tinycolor2 hoặc chroma-js
  // Ở đây em sẽ dùng helper đơn giản hoặc chỉ inject màu chính
  return {
    primary: primaryHex,
    // Các màu này sẽ được tính toán qua CSS filters hoặc opacity trong Tailwind
  };
};

