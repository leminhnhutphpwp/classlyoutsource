export function compactFormat(value: number) {
  const formatter = new Intl.NumberFormat("en", {
    notation: "compact",
    compactDisplay: "short",
  });

  return formatter.format(value);
}

export function standardFormat(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format percentage: removes trailing zeros for whole numbers, keeps 1 decimal for decimals
 * @param value - The percentage value (number or string)
 * @returns Formatted percentage string like "100%" or "27.8%"
 */
export function formatPercentage(value: number | string | null | undefined): string {
  if (value === null || value === undefined) {
    return '0%';
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numValue)) {
    return '0%';
  }

  // Format: remove trailing zeros for whole numbers, keep 1 decimal for decimals
  const formatted = numValue % 1 === 0 ? numValue.toString() : numValue.toFixed(1);

  return `${formatted}%`;
}

/**
 * Format storage size: converts MB to GB when >= 1000, removes trailing zeros
 * @param mb - Storage size in MB (number)
 * @returns Formatted storage string like "1 GB", "1.5 GB", "500 MB"
 */
export function formatStorage(mb: number): string {
  if (mb >= 1000) {
    const gb = mb / 1000;
    if (gb % 1 === 0) {
      return `${gb} GB`;
    }
    return `${gb.toFixed(2).replace(/\.?0+$/, '')} GB`;
  }
  if (mb % 1 === 0) {
    return `${mb} MB`;
  }
  return `${mb.toFixed(2).replace(/\.?0+$/, '')} MB`;
}

/**
 * Format file size from bytes to human readable format
 * Rounds up small files to at least 1 KB
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "1 KB", "25.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return "0 KB";

  // Rule: Small files below 1KB are rounded up to 1KB
  if (bytes < 1024) return "1 KB";

  const sizes = ["KB", "MB", "GB", "TB"];
  let size = bytes / 1024; // Start with KB
  let i = 0;

  // Switch unit if value is >= 1000 (e.g., 1000 KB -> 0.98 MB)
  // This avoids displaying large numbers like "1002 KB"
  while (size >= 1000 && i < sizes.length - 1) {
    size /= 1024;
    i++;
  }

  return `${Math.ceil(size)} ${sizes[i]}`;
}