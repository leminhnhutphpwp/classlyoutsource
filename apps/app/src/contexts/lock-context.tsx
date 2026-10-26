'use client';

import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import type { ApiResponse } from '@/lib/api-config';

type LockType = 'login' | 'actions' | 'all' | undefined;

export interface ActionLockInfo {
  code: 'ACCOUNT_ACTIONS_LOCKED' | 'ACCOUNT_LOCKED' | 'ACCOUNT_INACTIVE' | 'TUTOR_INACTIVE';
  message: string;
  reason?: string;
  locked_from?: string;
  locked_until?: string;
  type?: LockType;
}

interface LockContextValue {
  actionsLocked: boolean;
  lockInfo: ActionLockInfo | null;
  setActionLockFromResponse: (response: ApiResponse<any>) => void;
  clearActionLock: () => void;
  // Single-tenant: no plan-based feature lock. Always null; kept so pages that destructure it
  // compile unchanged (mirrors the backend's no-op plan capability stubs).
  planFeatureMessage: string | null;
  clearPlanFeatureMessage: () => void;
}

const LockContext = createContext<LockContextValue | undefined>(undefined);

export function LockProvider({ children }: { children: React.ReactNode }) {
  const [lockInfo, setLockInfo] = useState<ActionLockInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const actionsLocked = useMemo(
    () =>
      !!lockInfo &&
      (lockInfo.code === 'ACCOUNT_ACTIONS_LOCKED' ||
        lockInfo.code === 'ACCOUNT_LOCKED' ||
        lockInfo.code === 'ACCOUNT_INACTIVE' ||
        lockInfo.code === 'TUTOR_INACTIVE'),
    [lockInfo]
  );

  const setActionLockFromResponse = (response: ApiResponse<any>) => {
    if (
      response.code !== 'ACCOUNT_ACTIONS_LOCKED' &&
      response.code !== 'ACCOUNT_LOCKED' &&
      response.code !== 'ACCOUNT_INACTIVE' &&
      response.code !== 'TUTOR_INACTIVE'
    ) {
      return;
    }

    const data: any = (response as any).data || {};

    setLockInfo({
      code: response.code as ActionLockInfo['code'],
      message: response.message || '',
      reason: data.reason,
      locked_from: data.locked_from,
      locked_until: data.locked_until,
      type: data.type as LockType,
    });
    setDismissed(false);
  };

  const clearActionLock = () => {
    // Chỉ ẩn popup, vẫn giữ trạng thái actionsLocked để block các nút hành động
    setDismissed(true);
  };

  // Khi popup lock đang hiển thị, khóa scroll nền cho đồng bộ với các popup khác
  useEffect(() => {
    const shouldLockScroll = actionsLocked && lockInfo && !dismissed;
    if (!shouldLockScroll) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow || '';
      document.documentElement.style.overflow = previousHtmlOverflow || '';
    };
  }, [actionsLocked, lockInfo, dismissed]);

  return (
    <LockContext.Provider
      value={{
        actionsLocked,
        lockInfo,
        setActionLockFromResponse,
        clearActionLock,
        planFeatureMessage: null,
        clearPlanFeatureMessage: () => {},
      }}
    >
      {children}

      {/* Global popup khi tài khoản bị lock (actions / all) */}
      {actionsLocked && lockInfo && !dismissed && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
              {lockInfo.code === 'ACCOUNT_INACTIVE' || lockInfo.code === 'TUTOR_INACTIVE'
                ? 'Tài khoản đã bị vô hiệu hóa'
                : 'Tài khoản của bạn đang bị tạm khóa'}
            </h2>
            <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-line">
              {lockInfo.message ||
                'Bạn tạm thời không thể tạo, sửa hoặc xóa dữ liệu cho đến khi việc kiểm tra hoàn tất.'}
            </p>
            {lockInfo.reason && (
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                <span className="font-medium">Lý do: </span>
                {lockInfo.reason}
              </p>
            )}
            {lockInfo.locked_until && (
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                <span className="font-medium">Dự kiến mở khóa: </span>
                {new Date(lockInfo.locked_until).toLocaleString('vi-VN')}
              </p>
            )}
            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
              Bạn tạm thời không thể đăng nhập hoặc sử dụng các chức năng chính của hệ thống. Mọi
              thao tác tạo, sửa hoặc xóa dữ liệu sẽ bị chặn cho đến khi khóa được gỡ.
            </p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={clearActionLock}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </LockContext.Provider>
  );
}

export function useLockContext() {
  const ctx = useContext(LockContext);
  if (!ctx) {
    throw new Error('useLockContext must be used within a LockProvider');
  }
  return ctx;
}