'use client';

import { useMemo } from 'react';
import { apiClient } from '@/lib/api-client';
import { useAuthContext } from '@/contexts/auth-context';
import { isTutor } from '@/lib/permissions-utils';
import type { AiGenerateQuestionsRequest } from '@/lib/api-config';
import { useMutation } from './core';

/**
 * AI features (grading suggestions + question generation) are always available
 * to tutors in the outsource single-client build. Super admins also have access.
 */
export function useAiAccess(): { canUseAi: boolean } {
  const { user } = useAuthContext();

  const canUseAi = useMemo(() => {
    if (!user) return false;

    // Super admin has every capability.
    if (user.role === 'super_admin' || (user.roles ?? []).includes('super_admin')) {
      return true;
    }

    // AI is a tutor-facing feature.
    if (!isTutor(user)) return false;

    return true;
  }, [user]);

  return { canUseAi };
}

/**
 * AI grading suggestion (Pro). POST that costs money — trigger on user action only.
 * Invalidate the submission caches so the stored suggestion / fresh submission shows up.
 */
export function useAiGradeSubmission() {
  return useMutation((submissionId: string) => apiClient.aiGradeSubmission(submissionId), {
    getInvalidatePrefixes: (submissionId: string) => [`submission:${submissionId}`, 'assignment:'],
  });
}

/**
 * Accept an AI grading suggestion as the official grade (Pro). Optional payload lets the tutor
 * override the suggested score/feedback before committing. On success the submission becomes
 * `graded`, so invalidate the submission + assignment caches to reflect the real score.
 */
export function useAcceptAiGrade() {
  return useMutation(
    (submissionId: string, payload?: { score?: number; feedback?: string }) =>
      apiClient.acceptAiGrade(submissionId, payload),
    {
      getInvalidatePrefixes: (submissionId: string) => [`submission:${submissionId}`, 'assignment:'],
    }
  );
}

/**
 * Map backend error codes from the AI-grade accept flow to friendly Vietnamese messages.
 * Falls back to the server message (or a generic one) for anything unmapped.
 */
export function aiGradeAcceptErrorMessage(code?: string, fallback?: string): string {
  switch (code) {
    case 'AI_NO_SUGGESTION':
      return 'Chưa có gợi ý từ AI. Vui lòng bấm "Gợi ý chấm bằng AI" trước khi chấp nhận.';
    case 'AI_QUOTA_EXCEEDED':
      return 'Bạn đã dùng hết lượt AI. Vui lòng thử lại sau.';
    case 'VALIDATION_ERROR':
      return fallback || 'Điểm không hợp lệ hoặc vượt quá điểm tối đa.';
    default:
      return fallback || 'Không thể áp dụng gợi ý của AI. Vui lòng thử lại.';
  }
}

/**
 * AI question generation (Pro). POST that costs money — trigger on user action only.
 * Nothing is saved server-side, so there is no cache to invalidate.
 */
export function useAiGenerateQuestions() {
  return useMutation((assignmentId: string, payload: AiGenerateQuestionsRequest) =>
    apiClient.aiGenerateQuestions(assignmentId, payload)
  );
}
