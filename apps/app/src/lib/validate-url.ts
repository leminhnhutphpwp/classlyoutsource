/**
 * Validate and sanitize URLs to prevent XSS and open redirect attacks
 * 
 * @param url - The URL string to validate
 * @param allowedProtocols - Array of allowed protocols (default: ['http:', 'https:'])
 * @returns Validated URL or null if invalid
 * 
 * @example
 * validateUrl('https://example.com') // Returns: 'https://example.com'
 * validateUrl('javascript:alert(1)') // Returns: null
 * validateUrl('//evil.com') // Returns: null (protocol-relative URLs not allowed)
 */
export function validateUrl(
  url: string | null | undefined,
  allowedProtocols: string[] = ['http:', 'https:']
): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // Trim whitespace
  const trimmedUrl = url.trim();
  
  if (!trimmedUrl) {
    return null;
  }

  // Block javascript: and data: protocols
  const lowerUrl = trimmedUrl.toLowerCase();
  if (
    lowerUrl.startsWith('javascript:') ||
    lowerUrl.startsWith('data:') ||
    lowerUrl.startsWith('vbscript:') ||
    lowerUrl.startsWith('file:') ||
    lowerUrl.startsWith('about:')
  ) {
    return null;
  }

  // Block protocol-relative URLs (//evil.com) to prevent open redirect
  if (trimmedUrl.startsWith('//')) {
    return null;
  }

  try {
    // Parse URL to validate format
    const parsedUrl = new URL(trimmedUrl);
    
    // Check if protocol is allowed
    if (!allowedProtocols.includes(parsedUrl.protocol)) {
      return null;
    }

    // Return the validated URL
    return parsedUrl.href;
  } catch {
    // If URL parsing fails, it might be a relative URL
    // For relative URLs, only allow paths starting with /
    if (trimmedUrl.startsWith('/')) {
      // Validate that it doesn't contain dangerous characters
      if (!/^\/[^<>"']*$/.test(trimmedUrl)) {
        return null;
      }
      return trimmedUrl;
    }

    // Invalid URL format
    return null;
  }
}

/**
 * Validate external URL (must be absolute URL with http/https)
 * 
 * @param url - The URL string to validate
 * @returns Validated URL or null if invalid
 */
export function validateExternalUrl(url: string | null | undefined): string | null {
  return validateUrl(url, ['http:', 'https:']);
}

/**
 * Validate payment URL (must be absolute URL with http/https)
 * Additional validation for payment URLs
 * 
 * @param url - The payment URL string to validate
 * @returns Validated URL or null if invalid
 */
export function validatePaymentUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  
  const validated = validateExternalUrl(url);
  
  if (!validated) return null;
  
  // Additional check: ensure it's not pointing to localhost/internal IPs in production
  // (This is a basic check, backend should also validate)
  try {
    const parsed = new URL(validated);
    const hostname = parsed.hostname.toLowerCase();
    
    // Block localhost and internal IPs (basic check)
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.16.') ||
      hostname.startsWith('172.17.') ||
      hostname.startsWith('172.18.') ||
      hostname.startsWith('172.19.') ||
      hostname.startsWith('172.20.') ||
      hostname.startsWith('172.21.') ||
      hostname.startsWith('172.22.') ||
      hostname.startsWith('172.23.') ||
      hostname.startsWith('172.24.') ||
      hostname.startsWith('172.25.') ||
      hostname.startsWith('172.26.') ||
      hostname.startsWith('172.27.') ||
      hostname.startsWith('172.28.') ||
      hostname.startsWith('172.29.') ||
      hostname.startsWith('172.30.') ||
      hostname.startsWith('172.31.')
    ) {
      // In production, this should be blocked, but allow in development
      if (process.env.NODE_ENV === 'production') {
        return null;
      }
    }
    
    return validated;
  } catch {
    return null;
  }
}

