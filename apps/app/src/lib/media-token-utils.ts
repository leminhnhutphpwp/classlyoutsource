/**
 * Utility functions for managing media tokens
 */

/**
 * Check if a token is expired based on expires_at timestamp
 */
export function isTokenExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt) < new Date();
}

/**
 * Refresh media token by fetching resource again
 * Returns the new preview_url or null if failed
 */
export async function refreshMediaToken(
  resourceId: string,
  fetchResource: (id: string) => Promise<any>
): Promise<string | null> {
  try {
    const resource = await fetchResource(resourceId);
    return resource?.media?.preview_url || resource?.media?.stream_url || null;
  } catch (error) {
    console.error('Error refreshing media token:', error);
    return null;
  }
}

/**
 * Get the appropriate media URL based on resource type
 */
export function getMediaUrl(
  resource: {
    type?: string;
    media?: {
      preview_url?: string;
      stream_url?: string;
      download_url?: string;
    };
  }
): string | null {
  if (!resource?.media) return null;

  const type = resource.type?.toLowerCase();

  // Video and audio use stream_url
  if ((type === 'video' || type === 'audio') && resource.media.stream_url) {
    return resource.media.stream_url;
  }

  // Images and documents use preview_url
  if (resource.media.preview_url) {
    return resource.media.preview_url;
  }

  // Fallback to download_url
  return resource.media.download_url || null;
}

