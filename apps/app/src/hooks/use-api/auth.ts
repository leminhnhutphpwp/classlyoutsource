'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import { checkAndClearCacheIfUserChanged, invalidateClientCache, setCacheUser } from '@/lib/client-cache';
import { type ApiResponse } from '@/lib/api-config';
import { useLockContext } from '@/contexts/lock-context';
import { getObjId } from '@/lib/id-utils';
import { sanitizeErrorMessage, autoRedirectIfUnauthenticated } from './core';

function getErrorMessage(response: ApiResponse): string {
  if (
    response.code === 'ACCOUNT_LOCKED' ||
    response.code === 'ACCOUNT_INACTIVE' ||
    response.code === 'ACCOUNT_ACTIONS_LOCKED' ||
    response.code === 'TUTOR_INACTIVE' ||
    response.code === 'TUTOR_ACTIVE'
  ) {
    const baseMessage =
      response.message ||
      (response.code === 'ACCOUNT_INACTIVE' || response.code === 'TUTOR_INACTIVE' || response.code === 'TUTOR_ACTIVE'
        ? 'Tài khoản đã bị vô hiệu hóa.'
        : response.code === 'ACCOUNT_LOCKED'
          ? 'Tài khoản đã bị tạm khóa.'
          : 'Tài khoản đang bị tạm khóa, bạn không thể thực hiện thao tác này.');

    const data: any = (response as any).data || {};
    const parts: string[] = [baseMessage];

    if (data.reason) {
      parts.push(`Lý do: ${data.reason}`);
    }
    if (data.locked_until) {
      parts.push(
        `Thời gian mở khóa dự kiến: ${new Date(data.locked_until).toLocaleString('vi-VN')}`
      );
    }

    return parts.join(' ');
  }

  if (response.errors && typeof response.errors === 'object') {
    const errorMessages: string[] = [];
    for (const [_field, messages] of Object.entries(response.errors)) {
      if (Array.isArray(messages)) {
        errorMessages.push(...messages);
      } else if (typeof messages === 'string') {
        errorMessages.push(messages);
      }
    }
    if (errorMessages.length > 0) {
      return errorMessages.join('. ');
    }
  }
  return response.message || 'Đã xảy ra lỗi';
}

// Auth hooks
// Singleton để deduplicate /api/auth/token calls khi nhiều component mount cùng lúc
let tokenCheckPromise: Promise<{ authenticated: boolean }> | null = null;
let tokenCheckTimestamp: number = 0;
const TOKEN_CHECK_CACHE_TTL = 1000; // Cache kết quả trong 1 giây để tránh duplicate calls

async function checkTokenStatus(): Promise<{ authenticated: boolean }> {
  const now = Date.now();

  // Nếu có promise đang chạy và chưa hết cache TTL, reuse nó
  // Check lại sau khi đọc để tránh race condition
  if (tokenCheckPromise) {
    const age = now - tokenCheckTimestamp;
    if (age < TOKEN_CHECK_CACHE_TTL) {
      return tokenCheckPromise;
    }
    // Promise đã cũ, clear nó
    tokenCheckPromise = null;
  }

  // Tạo promise mới - đảm bảo chỉ có 1 promise được tạo
  // Nếu có race condition và promise đã được tạo bởi call khác, reuse nó
  if (!tokenCheckPromise) {
    tokenCheckPromise = (async () => {
      if (typeof window === 'undefined') {
        return { authenticated: false };
      }

      try {
        const tokenCheck = await fetch('/api/auth/token', {
          credentials: 'include',
        });
        
        if (tokenCheck.ok) {
          const data = await tokenCheck.json();
          return { authenticated: data.authenticated || false };
        }
      } catch {
        // Auth status is determined solely by the HttpOnly cookie via
        // /api/auth/token; there is no client-side token to fall back to (S2).
        return { authenticated: false };
      }
      return { authenticated: false };
    })();

    tokenCheckTimestamp = now;
  }

  return tokenCheckPromise;
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const lockContext = useLockContext();
  const lockContextRef = useRef(lockContext);

  useEffect(() => {
    lockContextRef.current = lockContext;
  }, [lockContext]);

  useEffect(() => {
    const initAuth = async () => {
      // Check authentication status first
      const tokenStatus = await checkTokenStatus();
      const isAuthenticated = tokenStatus.authenticated;

      // IMPORTANT: Only skip on /auth routes if NOT authenticated
      // If user just logged in (at /auth/sign-in) but has token, we should fetch user data
      if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        if (currentPath.startsWith('/auth') && !isAuthenticated) {
          // No token on auth page - user hasn't logged in yet
          setUser(null);
          setLoading(false);
          return;
        }
      }

      if (!isAuthenticated) {
        // No token, definitely not authenticated
        setUser(null);
        apiClient.clearToken();
        setLoading(false);
        return;
      }

      // Timeout safety: reset loading after 15s so a hung getMe can't pin the
      // whole app on a spinner (was 35s). The catch/finally below still runs.
      const timeoutSafety = setTimeout(() => {
        setLoading(false);
      }, 15000);

      // Has token, validate it by calling getMe
      // getMe sẽ tự động thử refresh token nếu token hết hạn (trong api-client)
      try {
        const response = await apiClient.getMe();
        clearTimeout(timeoutSafety);
        
        if (response.success && response.data?.user) {
          const user = response.data.user;
          setUser(user);
          if (typeof window !== 'undefined' && response.data.user.theme_key) {
            localStorage.setItem('theme_key', response.data.user.theme_key);
          }
        } else {
          const lockCodes = [
            'ACCOUNT_LOCKED',
            'ACCOUNT_INACTIVE',
            'ACCOUNT_ACTIONS_LOCKED',
            'TUTOR_INACTIVE',
            'ACCOUNT_LOGIN_LOCKED',
            'LOGIN_LOCKED',
          ];
          // Chỉ redirect nếu thực sự không thể refresh (UNAUTHENTICATED sau khi đã thử refresh)
          // apiClient đã tự động thử refresh token trước đó, nếu vẫn fail thì mới return UNAUTHENTICATED
          if (response.code === 'UNAUTHENTICATED' || lockCodes.includes(response.code || '')) {
            setUser(null);
            apiClient.clearToken();
            autoRedirectIfUnauthenticated(response);
          } else if (
            response.code === 'ACCOUNT_ACTIONS_LOCKED' ||
            response.code === 'ACCOUNT_LOCKED' ||
            response.code === 'ACCOUNT_INACTIVE' ||
            response.code === 'TUTOR_INACTIVE'
          ) {
            // Nếu backend trả trạng thái lock khi gọi /auth/me → bật popup lock toàn app
            lockContextRef.current.setActionLockFromResponse(response);
          }
          // Nếu không phải UNAUTHENTICATED, có thể là lỗi khác (network, server...) - không clear user
        }
      } catch {
        clearTimeout(timeoutSafety);
        // Network error hoặc lỗi khác - không clear token vì có thể chỉ là tạm thời
        // Trong trường hợp catch này thường là network error, không phải auth error
        // Không clear token để user có thể retry khi network recover
      } finally {
        clearTimeout(timeoutSafety);
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await apiClient.login(email, password);
      // Không gọi autoRedirectIfUnauthenticated ở đây vì /auth/login là endpoint public.
      // Trạng thái UNAUTHENTICATED tại đây chỉ là sai email/mật khẩu, không phải hết hạn phiên.
      if (response.success) {
        // 2FA: mật khẩu đúng nhưng cần bước xác thực thứ hai. Không có token nào được lưu ở
        // đây — trả challenge về cho UI để hiển thị bước nhập mã (POST /auth/2fa/verify).
        const loginData: any = response.data || {};
        if (loginData.requires_2fa) {
          return { success: true, requires_2fa: true, challenge: loginData.challenge } as any;
        }

        // Token đã được lưu trong apiClient.login()
        // Ưu tiên dùng user từ login response để tránh duplicate API call
        // useAuth() sẽ tự động validate token khi mount, không cần gọi getMe() ngay ở đây
        if (response.data?.user) {
          const user = response.data.user;
          setUser(user);

          // Chỉ xóa cache nếu user_id thay đổi (đổi tài khoản), không xóa khi login lại cùng user
          checkAndClearCacheIfUserChanged(getObjId(user));

          if (typeof window !== 'undefined' && user.theme_key) {
            localStorage.setItem('theme_key', user.theme_key);
          }
        } else {
          // Nếu login response không có user, mới gọi getMe() (trường hợp hiếm)
          try {
            const meResponse = await apiClient.getMe();
            if (meResponse.success && meResponse.data?.user) {
              const user = meResponse.data.user;
              setUser(user);

              // Chỉ xóa cache nếu user_id thay đổi
              checkAndClearCacheIfUserChanged(getObjId(user));

              if (typeof window !== 'undefined' && user.theme_key) {
                localStorage.setItem('theme_key', user.theme_key);
              }
            }
          } catch {
            // Nếu getMe fail, vẫn tiếp tục (useAuth sẽ retry khi mount)
          }
        }
        return { success: true };
      }

      // Tài khoản bị trung tâm khóa (suspended) → thông báo riêng, phân biệt với sai mật khẩu.
      if (response.code === 'ACCOUNT_SUSPENDED') {
        return {
          success: false,
          error: 'Tài khoản của bạn đã bị trung tâm khóa',
          code: 'ACCOUNT_SUSPENDED',
        } as any;
      }

      // Nếu tài khoản bị lock / inactive → bật popup lock global
      if (
        response.code === 'ACCOUNT_ACTIONS_LOCKED' ||
        response.code === 'ACCOUNT_LOCKED' ||
        response.code === 'ACCOUNT_INACTIVE' ||
        response.code === 'TUTOR_INACTIVE' ||
        response.code === 'TUTOR_ACTIVE'
      ) {
        lockContext.setActionLockFromResponse(response as any);
      }

      // Trả thêm code/data cho các trường hợp khóa tài khoản để FE có thể hiển thị message riêng nếu cần
      if (
        response.code === 'ACCOUNT_LOCKED' ||
        response.code === 'ACCOUNT_INACTIVE' ||
        response.code === 'TUTOR_INACTIVE' ||
        response.code === 'TUTOR_ACTIVE'
      ) {
        return {
          success: false,
          error: getErrorMessage(response),
          code: response.code,
          data: (response as any).data,
        } as any;
      }

      return { success: false, error: getErrorMessage(response) };
    } catch (error) {
      const errorMessage = error instanceof Error ? sanitizeErrorMessage(error.message) : 'Đăng nhập thất bại. Vui lòng thử lại.';
      return { success: false, error: errorMessage };
    }
  };

  // Hoàn tất đăng nhập 2FA: đổi challenge + mã (TOTP hoặc mã khôi phục) lấy token thật, rồi
  // nạp thông tin user y hệt luồng login thường.
  const verifyTwoFactor = async (challenge: string, code: string) => {
    try {
      const response = await apiClient.verifyTwoFactor(challenge, code);
      if (response.success) {
        try {
          const meResponse = await apiClient.getMe();
          if (meResponse.success && meResponse.data?.user) {
            const nextUser = meResponse.data.user;
            setUser(nextUser);
            checkAndClearCacheIfUserChanged(getObjId(nextUser));
            if (typeof window !== 'undefined' && nextUser.theme_key) {
              localStorage.setItem('theme_key', nextUser.theme_key);
            }
          }
        } catch {
          // Nếu getMe fail, vẫn coi như đăng nhập thành công (useAuth sẽ retry khi mount).
        }
        return { success: true };
      }
      return { success: false, error: getErrorMessage(response), code: response.code };
    } catch (error) {
      const errorMessage = error instanceof Error ? sanitizeErrorMessage(error.message) : 'Xác thực hai lớp thất bại. Vui lòng thử lại.';
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    try {
      await apiClient.logout();
    } catch {
      // Silent error handling
    } finally {
      setUser(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('theme_key');
      }
      // Xóa cache khi logout để tránh rò rỉ dữ liệu giữa các phiên/người dùng,
      // và reset namespace về "anon".
      invalidateClientCache();
      setCacheUser(null);
    }
  };

  const updateProfile = async (profileData: any) => {
    try {
      const response = await apiClient.updateProfile(profileData);
      if (response.success) {
        const newUser = response.data.user;
        setUser(newUser);
        return { success: true };
      }
      return { success: false, error: getErrorMessage(response) };
    } catch (error) {
      const errorMessage = error instanceof Error ? sanitizeErrorMessage(error.message) : 'Cập nhật thất bại. Vui lòng thử lại.';
      return { success: false, error: errorMessage };
    }
  };

  const changePassword = async (passwordData: any) => {
    try {
      const response = await apiClient.changePassword(passwordData);
      if (!response.success) {
        return { success: false, error: getErrorMessage(response) };
      }
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? sanitizeErrorMessage(error.message) : 'Đổi mật khẩu thất bại. Vui lòng thử lại.';
      return { success: false, error: errorMessage };
    }
  };

  const refetchUser = useCallback(async () => {
    try {
      const response = await apiClient.getMe();
      if (response.success && response.data?.user) {
        const user = response.data.user;
        setUser(user);
        if (typeof window !== 'undefined' && response.data.user.theme_key) {
          localStorage.setItem('theme_key', response.data.user.theme_key);
        }
      }
    } catch {
    }
  }, []);

  // Auto-refresh session when tab gains focus (uses /auth/me which already triggers refresh token logic)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let focusTimeout: ReturnType<typeof setTimeout> | undefined;

    const handleFocus = () => {
      // Debounce to tránh spam khi focus liên tục (Alt+Tab, chuyển cửa sổ nhanh)
      if (focusTimeout) {
        clearTimeout(focusTimeout);
      }

      focusTimeout = setTimeout(() => {
        // Chỉ refresh nếu đang có user (đã đăng nhập)
        if (!user) return;
        void refetchUser();
      }, 1000);
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      if (focusTimeout) {
        clearTimeout(focusTimeout);
      }
    };
  }, [user, refetchUser]);

  return {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    verifyTwoFactor,
    logout,
    updateProfile,
    changePassword,
    refetchUser,
  };
}
