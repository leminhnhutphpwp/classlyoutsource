/**
 * Media Optimization Utilities
 * Based on MEDIA-OPTIMIZATION-EXAMPLES.md
 */

export type OptimizationStatus = 'pending' | 'processing' | 'done' | 'failed' | 'skipped';

export interface OptimizationMeta {
  original_size: number;
  optimized_size: number;
  compression_ratio: number;
  converted_to_webp?: boolean;
  original_dimensions?: {
    width: number;
    height: number;
  };
  optimized_dimensions?: {
    width: number;
    height: number;
  };
  error?: string;
}

export interface MediaFile {
  _id: string;
  name: string;
  size: number;
  size_formatted: string;
  type: string;
  ext: string;
  mime_type: string;
  optimize_status: OptimizationStatus;
  optimized_at?: string;
  optimization_meta?: OptimizationMeta;
  preview_url: string;
  download_url: string;
  stream_url?: string;
  thumbnail_url?: string;
  expires_at: string;
}

export class MediaOptimizationUtils {
  
  static getOptimizedUrl(media: any, type: string = 'preview'): string {
    if (!media) return '';
    
    // Backend now automatically serves optimized content at the same endpoints
    // and uses HashID for media_id parameters consistently
    const urlKey = `${type}_url`;
    const url = this.getFullUrl(media[urlKey]);
    
    return url || '';
  }
  
  static getFullUrl(relativePath: string): string {
    if (!relativePath || relativePath.trim() === '') return '';
    
    // If already a full URL, return as is
    if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
      return relativePath;
    }
    
    // Ensure path starts with /
    const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
    
    // Use window.location.origin if available (client-side)
    if (typeof window !== 'undefined' && window.location) {
      return `${window.location.origin}${path}`;
    }
    
    // Fallback for server-side rendering
    return path;
  }
  
  static formatFileSize(bytes: number): string {
    if (!bytes) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    const power = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = (bytes / Math.pow(1024, power)).toFixed(1);
    
    return `${size} ${units[power]}`;
  }
  
  static getOptimizationSavings(meta: OptimizationMeta | undefined) {
    if (!meta || !meta.original_size || !meta.optimized_size) {
      return null;
    }
    
    const savings = meta.original_size - meta.optimized_size;
    const percentage = ((savings / meta.original_size) * 100).toFixed(1);
    
    return {
      bytes: savings,
      percentage: parseFloat(percentage),
      formatted: this.formatFileSize(savings)
    };
  }
  
  static shouldShowOptimizationBadge(_media: any): boolean {
    // Always return false since we no longer show optimization badges
    return false;
  }
  
  static getOptimizationBadgeConfig(_media: any) {
    // Always return null since we no longer show optimization badges
    return null;
  }
  
  static async pollOptimizationStatus(
    mediaId: string, 
    onUpdate: (data: any) => void, 
    maxAttempts: number = 20
  ): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        await this.sleep(5000); // Wait 5 seconds
        
        const response = await fetch(`/api/v1/media-optimization/${mediaId}/status`);
        const result = await response.json();
        
        onUpdate(result.data);
        
        if (result.data.optimize_status === 'done' || 
            result.data.optimize_status === 'failed') {
          break;
        }
      } catch (error) {
        console.error('Polling error:', error);
        break;
      }
    }
  }
  
  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  static isOptimizationSupported(mediaType: string): boolean {
    return ['image', 'video'].includes(mediaType);
  }
  
  static getExpectedOptimizationTime(mediaType: string, fileSize: number): string {
    if (mediaType === 'image') {
      return 'vài giây';
    } else if (mediaType === 'video') {
      const mb = fileSize / (1024 * 1024);
      if (mb < 50) return '2-5 phút';
      if (mb < 200) return '5-10 phút';
      return '10-20 phút';
    }
    return 'không xác định';
  }
}