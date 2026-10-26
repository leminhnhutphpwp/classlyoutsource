/**
 * Zalo Mini App utilities
 */

/**
 * Detect if running in Zalo app environment
 */
export function isZaloApp(): boolean {
  if (typeof window === 'undefined') return false;
  
  const userAgent = window.navigator.userAgent.toLowerCase();
  return userAgent.includes('zalo') || 
         userAgent.includes('zalominiapp') ||
         window.location.hostname.includes('zalo') ||
         // Check for Zalo specific objects
         !!(window as any).ZaloJavaScriptInterface ||
         !!(window as any).zalo;
}

/**
 * Detect if running in any mobile app webview
 */
export function isMobileAppWebView(): boolean {
  if (typeof window === 'undefined') return false;
  
  const userAgent = window.navigator.userAgent.toLowerCase();
  return userAgent.includes('wv') || // WebView indicator
         userAgent.includes('zalo') ||
         userAgent.includes('facebook') ||
         userAgent.includes('messenger') ||
         userAgent.includes('line') ||
         userAgent.includes('telegram');
}

/**
 * Safe download for Zalo and other mobile app environments
 */
export function safeDownload(blob: Blob, filename: string): void {
  try {
    if (isZaloApp() || isMobileAppWebView()) {
      // For Zalo and mobile apps, try to open in new tab/window
      const blobUrl = window.URL.createObjectURL(blob);
      
      // Try to open in new window first
      const newWindow = window.open(blobUrl, '_blank');
      
      if (!newWindow) {
        // If popup blocked, try direct navigation
        window.location.href = blobUrl;
      }
      
      // Cleanup after delay
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 5000);
      
    } else {
      // Standard download for regular browsers
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.setAttribute('data-nprogress-ignore', 'true');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    }
  } catch (error) {
    console.error('Download error:', error);
    throw new Error('Không thể tải xuống file trong môi trường này. Vui lòng thử mở ứng dụng trong trình duyệt web.');
  }
}

/**
 * Show download instructions for Zalo users
 */
export function getZaloDownloadInstructions(): string {
  return 'Để tải xuống file, vui lòng:\n1. Nhấn vào nút "Mở trong trình duyệt" (biểu tượng 3 chấm)\n2. Chọn "Mở bằng Safari/Chrome"\n3. Thực hiện tải xuống trong trình duyệt';
}