/**
 * Utility functions for converting backend media URLs to Next.js API routes
 */

/**
 * Convert backend media URL to Next.js API route
 * Backend URLs: /api/v1/learning-resources/{id}/preview?token=...
 * Next.js routes: /api/learning-resources/{id}/preview?token=...
 */
export function convertMediaUrlToNextRoute(url: string | null | undefined): string | null {
  if (!url) return null;
  
  // If already a Next.js route, return as is
  if (url.startsWith('/api/learning-resources/')) {
    return url;
  }
  
  // Convert from backend format to Next.js format
  // /api/v1/learning-resources/{id}/preview?token=... -> /api/learning-resources/{id}/preview?token=...
  // /api/v1/learning-resources/{id}/stream?token=... -> /api/learning-resources/{id}/stream?token=...
  // /api/v1/learning-resources/{id}/thumbnail?token=... -> /api/learning-resources/{id}/thumbnail?token=...
  // /api/v1/learning-resources/{id}/download?token=... -> /api/learning-resources/{id}/download?token=...
  if (url.startsWith('/api/v1/learning-resources/')) {
    return url.replace('/api/v1/learning-resources/', '/api/learning-resources/');
  }
  
  // If it's a full URL, try to extract the path
  try {
    const urlObj = new URL(url);
    if (urlObj.pathname.startsWith('/api/v1/learning-resources/')) {
      // Convert to Next.js format
      const path = urlObj.pathname.replace('/api/v1/learning-resources/', '/api/learning-resources/');
      return `${path}${urlObj.search}`;
    }
  } catch {
    // Not a valid URL, return as is
  }
  
  return url;
}

