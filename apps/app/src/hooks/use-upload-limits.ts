'use client';

import { useMemo } from 'react';

export interface UploadLimits {
  maxUploadMb: number | null; // null = unlimited
  maxUploadBytes: number | null;
  unlimited: boolean;
}

/**
 * Giới hạn upload của hệ thống (giới hạn do cấu hình hệ thống quyết định).
 * Bản outsource single-client: dung lượng upload do hệ thống quy định chung.
 */
export function useUploadLimits(): {
  limits: UploadLimits | null;
  loading: boolean;
  formatMaxSize: () => string;
  validateFileSize: (fileSize: number) => { valid: boolean; error?: string };
} {
  const limits = useMemo<UploadLimits | null>(() => {
    // Giới hạn do cấu hình hệ thống quyết định phía backend khi upload.
    return null;
  }, []);

  const formatMaxSize = (): string => {
    return "Không giới hạn";
  };

  const validateFileSize = (_fileSize: number): { valid: boolean; error?: string } => {
    // Giới hạn dung lượng được kiểm tra phía backend.
    return { valid: true };
  };

  return {
    limits,
    loading: false,
    formatMaxSize,
    validateFileSize,
  };
}