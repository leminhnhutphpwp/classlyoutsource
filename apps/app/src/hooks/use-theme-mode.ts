'use client';

import { useEffect, useState, useCallback } from 'react';

type ThemeMode = 'light' | 'dark';

interface UpdateModeResult {
  success: boolean;
  message?: string;
}

/**
 * Hook để quản lý mode (light/dark)
 * - Đọc mode từ user.mode (source of truth)
 * - localStorage chỉ để UI persistence, không dùng để load state
 * - Hỗ trợ optimistic updates cho UX mượt mà
 */
export function useThemeMode(initialMode?: ThemeMode) {
  const [mode, setMode] = useState<ThemeMode>(initialMode || 'light');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyModeToDocument = useCallback((nextMode: ThemeMode) => {
    if (typeof document === 'undefined') return;
    
    const root = document.documentElement;
    if (nextMode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    localStorage.setItem('mode', nextMode);
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('mode-updated', { detail: { mode: nextMode } }));
    }, 0);
  }, []);

  useEffect(() => {
    if (initialMode === 'light' || initialMode === 'dark') {
      setMode(initialMode);
      applyModeToDocument(initialMode);
    } else {
      const defaultMode: ThemeMode = 'light';
      setMode(defaultMode);
      applyModeToDocument(defaultMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  useEffect(() => {
    const localStorageMode = typeof window !== 'undefined' ? localStorage.getItem('mode') as ThemeMode | null : null;
    const isRecentUpdate = localStorageMode === mode;
    
    if ((initialMode === 'light' || initialMode === 'dark') && initialMode !== mode && !isRecentUpdate) {
      setMode(initialMode);
      applyModeToDocument(initialMode);
    }
  }, [initialMode, mode, applyModeToDocument]);

  const updateMode = useCallback(
    async (nextMode: ThemeMode, optimistic: boolean = false): Promise<UpdateModeResult> => {
      if (!optimistic) {
        setLoading(true);
        setError(null);
      }
      
      try {
        const res = await fetch('/api/auth/mode', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: nextMode }),
        });

        const data = await res.json();
        if (!res.ok) {
          const message = data?.message || 'Cập nhật chế độ hiển thị thất bại';
          setError(message);
          return { success: false, message };
        }

        if (!optimistic) {
          setMode(nextMode);
          applyModeToDocument(nextMode);
        } else {
          setMode((current) => current === nextMode ? nextMode : current);
        }
        return { success: true, message: data?.message };
      } catch (err: any) {
        const message = err?.message || 'Cập nhật chế độ hiển thị thất bại';
        setError(message);
        return { success: false, message };
      } finally {
        if (!optimistic) {
          setLoading(false);
        }
      }
    },
    [applyModeToDocument],
  );

  const setModeAndApply = useCallback((m: ThemeMode) => {
    setMode(m);
    applyModeToDocument(m);
  }, [applyModeToDocument]);

  return {
    mode,
    loading,
    error,
    setMode: setModeAndApply,
    updateMode,
  };
}


