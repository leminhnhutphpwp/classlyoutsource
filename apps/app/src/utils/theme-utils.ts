/**
 * Utility để làm sáng hoặc tối màu HEX
 */
export function adjustColor(hex: string, amount: number) {
  return '#' + hex.replace(/^#/, '').replace(/../g, hex => ('0' + Math.min(255, Math.max(0, parseInt(hex, 16) + amount)).toString(16)).slice(-2));
}

/**
 * Chuyển HEX sang RGBA với opacity
 */
export function hexToRgba(hex: string, opacity: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Tạo bộ màu theme từ màu chính
 */
export function generateThemeColors(primaryHex: string) {
  // Đảm bảo có dấu #
  const hex = primaryHex.startsWith('#') ? primaryHex : `#${primaryHex}`;
  
  return {
    primary: hex,
    primaryLight: adjustColor(hex, 40),
    primaryDark: adjustColor(hex, -40),
    primaryPastel: hexToRgba(hex, 0.1), // Dùng RGBA cho pastel
    // Giữ thêm bản HEX thuần cho chart sử dụng trực tiếp
    raw: {
      primary: hex,
      primaryLight: adjustColor(hex, 40),
      primaryDark: adjustColor(hex, -40),
    },
  };
}

