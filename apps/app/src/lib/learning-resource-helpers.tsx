"use client";

/**
 * Helper functions for learning resources
 */

import type { LearningResource } from './api-config';
import { DocumentTextIcon, LinkIcon, VideoCameraIcon, PhotoIcon, MusicalNoteIcon, CubeIcon } from '@heroicons/react/24/outline';
import type { ReactNode } from 'react';
import { formatFileSize } from './format-number';

/**
 * Get filename from learning resource
 * Backend ensures media.name is always populated when file exists
 * Fallback to file_url extraction for legacy data only
 */
export function getLearningResourceFileName(resource: LearningResource | null | undefined): string | undefined {
  if (!resource) return undefined;

  // Priority 1: media.name (backend always provides this when file exists)
  if (resource.media?.name && resource.media.name.trim() !== '') {
    return resource.media.name;
  }

  // Priority 2: Extract from file_url (fallback for legacy data only)
  if (resource.file_url) {
    const urlParts = resource.file_url.split('/');
    const filename = urlParts[urlParts.length - 1];
    // Only return if it's a valid filename (not the full URL)
    if (filename && filename !== resource.file_url && filename.includes('.')) {
      return filename;
    }
  }

  return undefined;
}

/**
 * Get display filename for learning resource
 * Returns a user-friendly message if filename is not available
 */
export function getLearningResourceDisplayFileName(resource: LearningResource | null | undefined): string {
  const fileName = getLearningResourceFileName(resource);
  return fileName || 'File đã được upload';
}

/**
 * Get file size from learning resource
 */
export function getLearningResourceFileSize(resource: LearningResource | null | undefined): string | undefined {
  if (!resource) return undefined;

  // For multiple images, calculate total size
  if (resource.type === 'image' && resource.media_files && resource.media_files.length > 0) {
    const totalSize = resource.media_files.reduce((sum: number, file: any) => {
      return sum + (file.size || 0);
    }, 0);
    
    if (totalSize > 0) {
      return formatFileSize(totalSize);
    }
  }

  // Rule: Prefer raw bytes for accurate formatting with our common helper
  if (resource.media?.size !== undefined && resource.media?.size !== null) {
    return formatFileSize(resource.media.size);
  }

  return resource.media?.size_formatted || resource.file_size || undefined;
}

/**
 * Get download URL for learning resource
 */
export function getLearningResourceDownloadUrl(
  resource: LearningResource | null | undefined,
  resourceId: string | number
): string | null {
  if (!resource) return null;

  if (resource.media?.download_url) {
    // Convert backend URL to Next.js API route
    return `/api${resource.media.download_url.replace('/api/v1', '')}`;
  }

  if (resource.file_url) {
    // Fallback to download endpoint
    return `/api/learning-resources/${resourceId}/download`;
  }

  return null;
}

/**
 * Get type badge info for learning resource
 * Returns icon, label, and styling classes for displaying resource type
 */
export function getLearningResourceTypeBadge(resource: LearningResource | any): {
  icon: ReactNode;
  label: string;
  bgColor: string;
  textColor: string;
} | null {
  if (!resource?.type) return null;

  const type = resource.type.toLowerCase();
  const isVideo =
    type === 'video' ||
    resource.external_url?.includes("youtube") ||
    resource.external_url?.includes("youtu.be");
  const isExternal = !!resource.external_url || type === 'link' || type === 'external';
  const isImage = type === 'image';
  const isAudio = type === 'audio';
  const isOther = type === 'other';
  const isPdf =
    type === 'pdf' ||
    resource?.ext?.toLowerCase?.() === 'pdf' ||
    resource?.mime_type === 'application/pdf';

  if (isVideo) {
    return {
      icon: <VideoCameraIcon className="h-3 w-3" />,
      label: 'Video',
      bgColor: 'bg-red-100 dark:bg-red-900/20',
      textColor: 'text-red-700 dark:text-red-400',
    };
  }

  if (isImage) {
    const imageCount = resource.media_files?.length || 1;
    const label = imageCount > 1 ? `${imageCount} hình ảnh` : 'Hình ảnh';
    
    return {
      icon: <PhotoIcon className="h-3 w-3" />,
      label,
      bgColor: 'bg-purple-100 dark:bg-purple-900/20',
      textColor: 'text-purple-700 dark:text-purple-400',
    };
  }

  if (isAudio) {
    return {
      icon: <MusicalNoteIcon className="h-3 w-3" />,
      label: 'Âm thanh',
      bgColor: 'bg-green-100 dark:bg-green-900/20',
      textColor: 'text-green-700 dark:text-green-400',
    };
  }

  if (isPdf) {
    return {
      icon: <DocumentTextIcon className="h-3 w-3" />,
      label: 'PDF',
      bgColor: 'bg-orange-100 dark:bg-orange-900/20',
      textColor: 'text-orange-700 dark:text-orange-400',
    };
  }

  if (isExternal) {
    return {
      icon: <LinkIcon className="h-3 w-3" />,
      label: 'Liên kết',
      bgColor: 'bg-blue-100 dark:bg-blue-900/20',
      textColor: 'text-blue-700 dark:text-blue-400',
    };
  }

  if (isOther) {
    return {
      icon: <CubeIcon className="h-3 w-3" />,
      label: 'Khác',
      bgColor: 'bg-gray-100 dark:bg-gray-900/20',
      textColor: 'text-gray-700 dark:text-gray-400',
    };
  }

  // Default: document/file
  return {
    icon: <DocumentTextIcon className="h-3 w-3" />,
    label: 'Tài liệu',
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/20',
    textColor: 'text-indigo-700 dark:text-indigo-400',
  };
}

