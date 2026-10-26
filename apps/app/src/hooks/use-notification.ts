import { useCallback } from 'react';
import { useToast } from '@/contexts/toast-context';

export function useNotification() {
  const { addToast } = useToast();

  const success = useCallback((title: string, message?: string) => {
    addToast({
      type: 'success',
      title,
      message,
    });
  }, [addToast]);

  const error = useCallback((title: string, message?: string) => {
    addToast({
      type: 'error',
      title,
      message,
    });
  }, [addToast]);

  const warning = useCallback((title: string, message?: string) => {
    addToast({
      type: 'warning',
      title,
      message,
    });
  }, [addToast]);

  const info = useCallback((title: string, message?: string) => {
    addToast({
      type: 'info',
      title,
      message,
    });
  }, [addToast]);

  return {
    success,
    error,
    warning,
    info,
  };
}
