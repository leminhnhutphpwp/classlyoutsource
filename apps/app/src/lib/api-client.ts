import { API_CONFIG, ApiResponse, QuizQuestion, QuizSettings, AiGradeResult, AiGenerateQuestionsRequest, AiGenerateQuestionsResult, Submission } from './api-config';
import type { LoginHistoryFilters, LoginHistoryResponse } from '@/types/login-history';
import type {
  ReportOverviewFilters,
  RevenueReportFilters,
  ReportStatisticsFilters,
  PaymentStatisticsFilters,
  PaymentsReportFilters,
  AttendanceReportFilters,
  StudentsReportFilters,
  ClassesReportFilters,
  AssignmentsReportFilters,
} from '@/types/reports';
import { requestDeduplicationManager } from './request-deduplication';
import { observeAndInvalidateCache } from './cache-observers';

class ApiClient {
  private baseURL: string;
  private token: string | null = null;
  private refreshTokenValue: string | null = null;
  private refreshPromise: Promise<ApiResponse> | null = null; // Lock để tránh multiple refresh calls

  constructor() {
    // Use Next.js API routes (relative paths)
    // Empty string means relative URLs, which will use Next.js API routes
    this.baseURL = API_CONFIG.BASE_URL || '';
    // Tokens live exclusively in HttpOnly cookies (S2). They are never read from
    // or written to localStorage, so nothing to hydrate here. Same-origin /api/*
    // calls send the cookie automatically and the BFF attaches the Bearer token.
  }

  /**
   * Get current in-memory token, if any.
   * Tokens are held in HttpOnly cookies; this only returns a value when a code
   * path has set one in-memory this session. It is never read from localStorage.
   * @returns Current token or null
   */
  private getCurrentToken(): string | null {
    return this.token;
  }

  /**
   * Build Authorization header if token exists
   * Always send Authorization header as fallback even for /api/* routes
   * Next.js API routes will use cookie first, but Authorization header serves as fallback
   * @returns Authorization header object or empty object
   */
  private getAuthHeader(): Record<string, string> {
    const token = this.getCurrentToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /**
   * No-op retained for call sites in the retry path.
   * Tokens are managed by the BFF in HttpOnly cookies, so there is nothing to
   * sync from client storage after a refresh — the rotated cookie is sent
   * automatically on the retried request.
   * @returns always false
   */
  private syncTokenFromStorage(): boolean {
    return false;
  }

  /**
   * Internal request method - thực hiện actual HTTP request
   * @param endpoint API endpoint
   * @param options Request options
   * @param retrying Đang retry sau khi refresh token
   * @returns API response
   */
  private async _performRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    retrying = false
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;

    // Nếu retry sau khi refresh, đảm bảo lấy token mới nhất từ storage hoặc instance
    if (retrying) {
      this.syncTokenFromStorage();
    }

    // Check if body is FormData - don't set Content-Type header for FormData
    const isFormData = options.body instanceof FormData;

    // Timeout: 30 giây cho các requests thông thường, 10 giây cho refresh token
    const timeoutMs = endpoint.includes('/auth/refresh') ? 10000 : 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const config: RequestInit = {
      headers: {
        'Accept': 'application/json',
        // Only set Content-Type if not FormData (browser will set it with boundary for FormData)
        ...(!isFormData && { 'Content-Type': 'application/json' }),
        ...this.getAuthHeader(),
        ...options.headers,
      },
      // Include cookies (HttpOnly cookies) in all requests
      credentials: 'include',
      signal: controller.signal,
      ...options,
    };

    try {
      const response = await fetch(url, config);
      clearTimeout(timeoutId);
      let responseData: any;
      try {
        responseData = await response.json();
      } catch {
        if (!response.ok) {
          return {
            success: false,
            message: `Lỗi ${response.status}: ${response.statusText}`
          };
        }
        return {
          success: false,
          message: 'Phản hồi không hợp lệ từ máy chủ'
        };
      }

      // Đừng tự động refresh cho chính route /auth/refresh để tránh lặp vô hạn
      const isRefreshEndpoint = endpoint.includes('/auth/refresh');

      // Một số endpoint auth là public (login, forgot-password, verify-code, reset-password)
      // → không nên auto-refresh khi bị 401/UNAUTHENTICATED, vì đó là lỗi credentials chứ không phải hết phiên.
      const isPublicAuthEndpoint =
        endpoint.includes('/auth/login') ||
        endpoint.includes('/auth/forgot-password') ||
        endpoint.includes('/auth/verify-code') ||
        endpoint.includes('/auth/reset-password');

      // Nếu backend trả về lock codes → clear token và không refresh
      const lockCodes = [
        'ACCOUNT_LOCKED',
        'ACCOUNT_INACTIVE',
        'ACCOUNT_ACTIONS_LOCKED',
        'TUTOR_INACTIVE',
        'ACCOUNT_LOGIN_LOCKED',
        'LOGIN_LOCKED',
      ];
      if (lockCodes.includes(responseData?.code)) {
        this.clearToken();
        return {
          success: false,
          message: this.formatErrorMessage(responseData?.message || 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị.'),
          code: responseData?.code,
        };
      }

      // Tài khoản bị TRUNG TÂM khóa (suspended). Khác với hết phiên (UNAUTHENTICATED):
      // đây là buộc đăng xuất, không auto-refresh. Ở trang app → điều hướng về đăng nhập
      // kèm lý do; ở trang /auth (vd đang đăng nhập 403) → trả code cho form xử lý.
      if (responseData?.code === 'ACCOUNT_SUSPENDED') {
        this.clearToken();
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth')) {
          try {
            sessionStorage.setItem('auth_forced_logout', 'ACCOUNT_SUSPENDED');
          } catch {
            // sessionStorage có thể bị chặn (private mode) — bỏ qua.
          }
          window.location.href = '/auth/sign-in?reason=suspended';
        }
        return {
          success: false,
          message: 'Tài khoản của bạn đã bị trung tâm khóa',
          code: 'ACCOUNT_SUSPENDED',
        };
      }

      // Auto-refresh token khi gặp 401/UNAUTHENTICATED (trừ chính endpoint refresh và các public auth endpoint)
      if (
        !retrying &&
        !isRefreshEndpoint &&
        !isPublicAuthEndpoint &&
        (
          response.status === 401 ||
          responseData?.code === "UNAUTHENTICATED" ||
          responseData?.message === "Chưa xác thực. Vui lòng đăng nhập." ||
          responseData?.message === "Unauthenticated."
        )
      ) {
        // Nếu đang có refresh đang chạy, đợi nó hoàn thành thay vì gọi lại
        if (this.refreshPromise) {
          try {
            const refreshResult = await this.refreshPromise;
            if (refreshResult.success) {
              // Refresh đã thành công, đảm bảo token mới được sync trước khi retry
              this.syncTokenFromStorage();
              // Retry request ban đầu với token mới (retry không cần deduplication)
              return this._performRequest<T>(endpoint, options, true);
            } else {
              // Refresh failed
              this.clearToken();
              return {
                success: false,
                message: refreshResult.message || 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
                code: 'UNAUTHENTICATED',
              };
            }
          } catch {
            // Nếu refresh promise có lỗi, clear và return error
            this.refreshPromise = null;
            this.clearToken();
            return {
              success: false,
              message: 'Không thể làm mới token',
              code: 'UNAUTHENTICATED',
            };
          }
        }

        // Nếu chưa có refresh đang chạy, bắt đầu refresh mới
        this.refreshPromise = this.refreshToken();
        let refreshResult: ApiResponse;
        try {
          refreshResult = await this.refreshPromise;
        } finally {
          // Clear promise sau khi xong (dù thành công hay fail)
          this.refreshPromise = null;
        }

        if (refreshResult.success) {
          // Token mới đã được set thành công, đảm bảo token mới được sync trước khi retry
          this.syncTokenFromStorage();
          // Retry request ban đầu với token mới (retry không cần deduplication)
          return this._performRequest<T>(endpoint, options, true);
        } else {
          // Refresh failed - token đã hết hạn hoàn toàn hoặc không hợp lệ
          // Chỉ clear token và return error - không redirect ở đây (để hooks quyết định)
          this.clearToken();
          return {
            success: false,
            message: refreshResult.message || 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
            code: 'UNAUTHENTICATED',
          };
        }
      }

      // Nếu chính refresh token cũng lỗi 401 → không retry nữa, clear token/lỗi
      if (
        isRefreshEndpoint &&
        (response.status === 401 || responseData?.code === "UNAUTHENTICATED")
      ) {
        this.clearToken();
        return {
          success: false,
          message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
          code: 'UNAUTHENTICATED',
        };
      }

      // Cache Observer: Auto-invalidate cache on successful mutations
      const method = (options.method || 'GET').toUpperCase();
      if (response.ok && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        observeAndInvalidateCache(endpoint, method as 'POST' | 'PUT' | 'PATCH' | 'DELETE');
      }

      // Xử lý kết quả như cũ
      if (typeof responseData === 'object' && responseData !== null && 'success' in responseData) {
        return {
          ...responseData,
          message: this.formatErrorMessage(responseData.message),
          ...(responseData.meta && { meta: responseData.meta })
        } as ApiResponse<T>;
      }
      if (response.ok) {
        return {
          success: true,
          message: responseData?.message || 'Thành công',
          data: responseData?.data || responseData,
          ...(responseData?.meta && { meta: responseData.meta })
        };
      }
      return {
        success: false,
        message: this.formatErrorMessage(responseData?.message || responseData?.error || 'Yêu cầu thất bại'),
        ...(responseData?.errors && { errors: responseData.errors }),
        ...(responseData?.code && { code: responseData.code })
      };
    } catch (error) {
      clearTimeout(timeoutId);
      // Check if error is due to timeout/abort
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          message: 'Yêu cầu đã hết thời gian chờ. Vui lòng thử lại.'
        };
      }
      return {
        success: false,
        message: 'Không thể kết nối đến máy chủ'
      };
    }
  }

  /**
   * Public request method với deduplication
   * Nếu cùng một request đang chạy, đợi request hiện tại thay vì gọi mới
   * @param endpoint API endpoint
   * @param options Request options
   * @param retrying Đang retry sau khi refresh token (không dùng deduplication cho retry)
   * @returns API response
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retrying = false
  ): Promise<ApiResponse<T>> {
    // Retry không cần deduplication vì đã là request thứ 2
    if (retrying) {
      return this._performRequest<T>(endpoint, options, retrying);
    }

    // Sử dụng deduplication cho các requests thông thường
    return requestDeduplicationManager.request(
      endpoint,
      () => this._performRequest<T>(endpoint, options, retrying),
      options
    );
  }

  /**
   * Public method để thực hiện generic request (dùng cho batch requests)
   * @param endpoint API endpoint
   * @param options Request options
   * @returns API response
   */
  async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, options, false);
  }

  /**
   * Sanitize error message để loại bỏ domain/URL và thông tin nhạy cảm
   * @param message Thông báo lỗi
   * @returns Thông báo đã được sanitize
   */
  private sanitizeErrorMessage(message: string): string {
    if (!message) return message;

    // Remove URLs
    const sanitized = message
      .replace(/https?:\/\/[^\s]+/gi, '[server]')
      .replace(/[a-zA-Z0-9.-]+\.(com|net|org|io|online|dev|local|test|vn|edu|gov)[^\s]*/gi, '[server]')
      // Remove technical error codes that might expose server info
      .replace(/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|EAI_AGAIN/gi, '')
      // Remove IP addresses
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[server]')
      // Remove port numbers in error messages
      .replace(/:\d{1,5}/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return sanitized || 'Đã xảy ra lỗi. Vui lòng thử lại.';
  }

  /**
   * Format error message từ backend thành thông báo thân thiện với người dùng
   * @param message Thông báo lỗi từ backend
   * @returns Thông báo đã được format
   */
  private formatErrorMessage(message?: string): string {
    if (!message) {
      return 'Đã xảy ra lỗi. Vui lòng thử lại.';
    }

    // Chuyển đổi các thông báo lỗi kỹ thuật thành thông báo thân thiện
    const errorMappings: Array<{ pattern: RegExp; replacement: string }> = [
      // HTTP method không được hỗ trợ
      {
        pattern: /The (PATCH|PUT|POST|DELETE|GET) method is not supported for route/i,
        replacement: 'Thao tác không được hỗ trợ. Vui lòng thử lại.'
      },
      {
        pattern: /method is not supported/i,
        replacement: 'Thao tác không được hỗ trợ. Vui lòng thử lại.'
      },
      {
        pattern: /Supported methods:/i,
        replacement: ''
      },
      // Validation errors
      {
        pattern: /validation error|validation failed/i,
        replacement: 'Dữ liệu không hợp lệ'
      },
      {
        pattern: /Trường (.+) không hợp lệ/i,
        replacement: 'Thông tin không hợp lệ. Vui lòng kiểm tra lại.'
      },
      // Server errors
      {
        pattern: /Internal Server Error|500/i,
        replacement: 'Lỗi hệ thống. Vui lòng thử lại sau.'
      },
      {
        pattern: /Service Unavailable|503/i,
        replacement: 'Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau.'
      },
      // Not found
      {
        pattern: /Not Found|404/i,
        replacement: 'Không tìm thấy dữ liệu.'
      },
      // Unauthorized
      {
        pattern: /Unauthorized|401/i,
        replacement: 'Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.'
      },
      // Forbidden
      {
        pattern: /Forbidden|403/i,
        replacement: 'Bạn không có quyền thực hiện thao tác này.'
      },
    ];

    // Sanitize message trước để loại bỏ domain/URL
    let formattedMessage = this.sanitizeErrorMessage(message);

    // Áp dụng các mapping
    for (const mapping of errorMappings) {
      formattedMessage = formattedMessage.replace(mapping.pattern, mapping.replacement);
    }

    // Loại bỏ các thông tin kỹ thuật không cần thiết
    formattedMessage = formattedMessage
      .replace(/api\/v1\/[^\s]+/gi, '') // Loại bỏ đường dẫn API
      .replace(/route [^\s]+/gi, '') // Loại bỏ route path
      .replace(/\s+/g, ' ') // Loại bỏ khoảng trắng thừa
      .trim();

    // Nếu message trống sau khi format, trả về message mặc định
    if (!formattedMessage) {
      return 'Đã xảy ra lỗi. Vui lòng thử lại.';
    }

    return formattedMessage;
  }

  /**
   * Helper method để build query string từ filters object
   * @param filters Object chứa các filter params
   * @param options Optional config cho việc xử lý filters
   * @returns Query string (không bao gồm dấu ?)
   */
  private buildQueryString(
    filters?: Record<string, any>,
    options?: {
      excludeValues?: string[]; // Các giá trị cần loại bỏ (ví dụ: 'all')
      dateFields?: string[]; // Các field là date cần format
    }
  ): string {
    if (!filters || Object.keys(filters).length === 0) {
      return '';
    }

    const queryParams = new URLSearchParams();
    const excludeValues = options?.excludeValues || ['all'];

    for (const [key, value] of Object.entries(filters)) {
      // Skip undefined, null, empty string
      if (value === undefined || value === null || value === '') {
        continue;
      }

      // Skip excluded values
      if (excludeValues.includes(value)) {
        continue;
      }

      queryParams.append(key, String(value));
    }

    return queryParams.toString();
  }

  /**
   * Helper method để build endpoint URL với query params
   * @param baseEndpoint Base endpoint path
   * @param filters Filters object
   * @param options Optional config
   * @returns Full endpoint URL với query string
   */
  private buildEndpointWithQuery(
    baseEndpoint: string,
    filters?: Record<string, any>,
    options?: { excludeValues?: string[]; dateFields?: string[] }
  ): string {
    const queryString = this.buildQueryString(filters, options);
    return queryString ? `${baseEndpoint}?${queryString}` : baseEndpoint;
  }

  // Auth methods
  async login(email: string, password: string): Promise<ApiResponse> {
    const response = await this.request(API_CONFIG.ENDPOINTS.AUTH.LOGIN, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.success && response.data && typeof response.data === 'object') {
      const data = response.data as any;
      // When 2FA is required the backend returns { requires_2fa, challenge } and NO token —
      // we deliberately do not store anything here; the caller drives the second step.
      if (data.token) {
        this.setToken(data.token);
      }
      if (data.refresh_token) {
        this.setRefreshToken(data.refresh_token);
      }
    }

    return response;
  }

  /**
   * Complete a 2FA login: exchange the login challenge + a TOTP/recovery code for the real
   * tokens. Goes through the bespoke /api/auth/2fa/verify BFF route which sets the same
   * HttpOnly cookies as normal login.
   */
  async verifyTwoFactor(challenge: string, code: string): Promise<ApiResponse> {
    const response = await this.request(API_CONFIG.ENDPOINTS.AUTH.TWO_FACTOR_VERIFY, {
      method: 'POST',
      body: JSON.stringify({ challenge, code }),
    });

    if (response.success && response.data && typeof response.data === 'object') {
      const data = response.data as any;
      if (data.token) {
        this.setToken(data.token);
      }
      if (data.refresh_token) {
        this.setRefreshToken(data.refresh_token);
      }
    }

    return response;
  }

  /** Step 1 of enabling 2FA — re-enter password, get provisioning URI + secret for the QR. */
  async enableTwoFactor(password: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.AUTH.TWO_FACTOR_ENABLE, {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  }

  /** Step 2 — confirm the pending secret with a 6-digit code; returns one-time recovery codes. */
  async confirmTwoFactor(code: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.AUTH.TWO_FACTOR_CONFIRM, {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  /** Disable 2FA — requires a valid TOTP/recovery code OR the current password. */
  async disableTwoFactor(payload: { code?: string; password?: string }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.AUTH.TWO_FACTOR_DISABLE, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /** Regenerate recovery codes — requires a valid TOTP/recovery code OR the current password. */
  async regenerateRecoveryCodes(payload: { code?: string; password?: string }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.AUTH.TWO_FACTOR_RECOVERY_REGENERATE, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async forgotPassword(email: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.AUTH.FORGOT_PASSWORD, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async verifyResetCode(email: string, code: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.AUTH.VERIFY_CODE, {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });
  }

  async resetPassword(data: {
    email: string;
    code: string;
    new_password: string;
    new_password_confirmation: string;
  }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.AUTH.RESET_PASSWORD, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }


  async logout(): Promise<ApiResponse> {
    const response = await this.request(API_CONFIG.ENDPOINTS.AUTH.LOGOUT, {
      method: 'POST',
    });

    this.clearToken();
    return response;
  }

  async refreshToken(): Promise<ApiResponse> {
    // Refresh relies entirely on the HttpOnly refresh_token cookie, which the
    // browser sends automatically to the same-origin BFF route. No token is read
    // from client storage and none is sent in the body (S2).

    // Use Next.js API route (baseURL is empty, endpoint is already full path)
    const url = API_CONFIG.ENDPOINTS.AUTH.REFRESH;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          // No Authorization header - refresh endpoint is public
        },
        // Include cookies (HttpOnly cookies) automatically - the BFF reads the
        // refresh_token cookie and forwards it to Laravel.
        credentials: 'include',
      });

      let responseData: any;
      try {
        responseData = await response.json();
      } catch {
        return {
          success: false,
          message: 'Phản hồi không hợp lệ từ máy chủ'
        };
      }

      // Handle successful refresh.
      // The BFF has rotated the tokens straight into HttpOnly cookies and strips
      // them from the body (S2), so the response only carries { success, message,
      // expires_in, ... } — never the raw JWT. Success is determined by the flag,
      // not by a token in the body.
      const data = responseData?.data || {};

      if (response.ok && responseData?.success) {
        // The rotated cookie is already set server-side and will be sent on the
        // retried request; there is no client-side token to persist.
        return {
          success: true,
          message: responseData?.message || 'Token đã được làm mới',
          data: data
        };
      }

      // Nếu refresh trả về lock codes → clear token và không tiếp tục refresh/giữ phiên
      const lockCodes = [
        'ACCOUNT_LOCKED',
        'ACCOUNT_INACTIVE',
        'ACCOUNT_ACTIONS_LOCKED',
        'TUTOR_INACTIVE',
        'ACCOUNT_LOGIN_LOCKED',
        'LOGIN_LOCKED',
      ];
      if (lockCodes.includes(responseData?.code)) {
        this.clearToken();
        return {
          success: false,
          message: responseData?.message || 'Tài khoản đã bị khóa. Vui lòng đăng nhập lại.',
          code: responseData?.code,
        };
      }

      // Handle refresh failure (refresh token expired or invalid)
      if (response.status === 401 || responseData?.code === 'UNAUTHENTICATED' || responseData?.code === 'TOKEN_REFRESH_FAILED') {
        // Refresh token expired or invalid - clear all tokens
        this.clearToken();
        return {
          success: false,
          message: responseData?.message || 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
          code: 'UNAUTHENTICATED',
        };
      }

      // Other errors (network, server, etc.)
      return {
        success: false,
        message: responseData?.message || 'Không thể làm mới token',
        code: responseData?.code || 'TOKEN_REFRESH_FAILED'
      };
    } catch {
      return {
        success: false,
        message: 'Không thể kết nối đến máy chủ để làm mới token'
      };
    }
  }

  async getMe(): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.AUTH.ME);
  }

  // Settings methods - Profile
  async getProfileSettings(): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.SETTINGS.PROFILE);
  }

  async updateProfile(profileData: {
    name?: string;
    phone?: string;
    address?: string;
    bio?: string;
    theme_key?: string;
    mode?: "light" | "dark";
  }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.SETTINGS.PROFILE, {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }

  async uploadAvatar(file: File): Promise<ApiResponse> {
    const formData = new FormData();
    formData.append('avatar', file);

    return this.request(API_CONFIG.ENDPOINTS.SETTINGS.PROFILE_AVATAR, {
      method: 'POST',
      body: formData,
    });
  }

  // Settings methods - Security
  async getSecuritySettings(): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.SETTINGS.SECURITY);
  }

  async changePassword(passwordData: {
    current_password: string;
    new_password: string;
    new_password_confirmation: string;
  }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.SETTINGS.SECURITY_CHANGE_PASSWORD, {
      method: 'POST',
      body: JSON.stringify(passwordData),
    });
  }

  async changeEmail(data: {
    new_email: string;
    password: string;
  }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.SETTINGS.SECURITY_CHANGE_EMAIL, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async sendVerificationEmail(): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.SETTINGS.SECURITY_SEND_VERIFICATION_EMAIL, {
      method: 'POST',
    });
  }

  async verifyEmail(code: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.SETTINGS.SECURITY_VERIFY_EMAIL, {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async getLoginHistory(filters?: LoginHistoryFilters): Promise<ApiResponse<LoginHistoryResponse>> {
    const endpoint = this.buildEndpointWithQuery(
      API_CONFIG.ENDPOINTS.AUTH.LOGIN_HISTORY,
      filters,
      { excludeValues: ['all', ''] }
    );
    return this.request(endpoint);
  }

  async getAllStudentsLoginHistory(filters?: LoginHistoryFilters): Promise<ApiResponse<LoginHistoryResponse>> {
    const endpoint = this.buildEndpointWithQuery(
      API_CONFIG.ENDPOINTS.LOGIN_ACTIVITY.STUDENTS,
      filters,
      { excludeValues: ['all', ''] }
    );
    return this.request(endpoint);
  }

  async getStudentLoginHistory(
    id: string,
    filters?: LoginHistoryFilters
  ): Promise<ApiResponse<LoginHistoryResponse>> {
    const endpoint = this.buildEndpointWithQuery(
      API_CONFIG.ENDPOINTS.STUDENTS.LOGIN_HISTORY(id),
      filters,
      { excludeValues: ['all', ''] }
    );
    return this.request(endpoint);
  }

  // Settings methods - Notifications
  async getNotificationSettings(): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.SETTINGS.NOTIFICATIONS);
  }

  async updateNotificationPreferences(preferences: { preferences: Array<{ notification_type: string; channels: string[]; is_enabled: boolean }> }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.SETTINGS.NOTIFICATIONS, {
      method: 'PUT',
      body: JSON.stringify(preferences),
    });
  }

  // Settings methods - Payment
  async getBankInfo(): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.SETTINGS.PAYMENT_BANK_INFO);
  }

  async updateBankInfo(data: {
    bank_name: string;
    account_number: string;
    account_name: string;
    branch?: string;
  }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.SETTINGS.PAYMENT_BANK_INFO, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Settings methods - Account Management
  async deactivateAccount(data: {
    password: string;
    reason?: string;
  }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.SETTINGS.ACCOUNT_DEACTIVATE, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteAccount(data: {
    password: string;
    confirmation_text: string;
    reason?: string;
  }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.SETTINGS.ACCOUNT_DELETE, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Dashboard methods
  async getDashboard(): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.DASHBOARD.INDEX);
  }

  async getDashboardStatistics(period?: string): Promise<ApiResponse> {
    const url = period
      ? `${API_CONFIG.ENDPOINTS.DASHBOARD.STATISTICS}?period=${period}`
      : API_CONFIG.ENDPOINTS.DASHBOARD.STATISTICS;
    return this.request(url);
  }

  async getRecentActivity(limit?: number): Promise<ApiResponse> {
    const url = limit
      ? `${API_CONFIG.ENDPOINTS.DASHBOARD.RECENT_ACTIVITY}?limit=${limit}`
      : API_CONFIG.ENDPOINTS.DASHBOARD.RECENT_ACTIVITY;
    return this.request(url);
  }

  async getReminders(options?: {
    type?: 'schedule' | 'payment' | 'assignment' | 'all';
    limit?: number;
    page?: number;
    days_ahead?: number;
    class_id?: string;
  }): Promise<ApiResponse> {
    const params = new URLSearchParams();
    if (options?.type) params.append('type', options.type);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.page) params.append('page', options.page.toString());
    if (options?.days_ahead) params.append('days_ahead', options.days_ahead.toString());
    if (options?.class_id) params.append('class_id', options.class_id.toString());

    const url = params.toString()
      ? `${API_CONFIG.ENDPOINTS.REMINDERS.INDEX}?${params.toString()}`
      : API_CONFIG.ENDPOINTS.REMINDERS.INDEX;
    return this.request(url);
  }

  // Classes methods
  async getClasses(filters?: { per_page?: number; page?: number; status?: string; search?: string }): Promise<ApiResponse> {
    const params = new URLSearchParams();
    if (filters?.per_page) params.append('per_page', filters.per_page.toString());
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.status) params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);

    const queryString = params.toString();
    const endpoint = queryString ? `${API_CONFIG.ENDPOINTS.CLASSES.LIST}?${queryString}` : API_CONFIG.ENDPOINTS.CLASSES.LIST;
    return this.request(endpoint);
  }

  async getClass(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.CLASSES.SHOW(id));
  }

  async createClass(classData: {
    name: string;
    description?: string;
    tutor_id?: string | number; // Optional - backend will auto-assign for Personal Tutor and Institution Tutor
    status?: 'active' | 'inactive';
  }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.CLASSES.CREATE, {
      method: 'POST',
      body: JSON.stringify(classData),
    });
  }

  async updateClass(id: string, classData: {
    name?: string;
    description?: string;
    tutor_id?: string | number; // Optional - backend will ignore for Personal Tutor and Institution Tutor
    status?: 'active' | 'inactive';
  }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.CLASSES.UPDATE(id), {
      method: 'PUT',
      body: JSON.stringify(classData),
    });
  }

  async deleteClass(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.CLASSES.DELETE(id), {
      method: 'DELETE',
    });
  }

  async getClassStudents(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.CLASSES.STUDENTS(id));
  }

  async getClassSchedules(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.CLASSES.SCHEDULES(id));
  }

  async getClassAssignments(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.CLASSES.ASSIGNMENTS(id));
  }

  async enrollStudent(
    classId: string,
    studentId: string,
    options?: { notes?: string; status?: 'active' | 'inactive' | 'suspended' | 'completed' }
  ): Promise<ApiResponse> {
    const body: any = { student_id: studentId };
    if (options?.notes) {
      body.notes = options.notes;
    }
    if (options?.status) {
      body.status = options.status;
    }
    return this.request(API_CONFIG.ENDPOINTS.CLASSES.ENROLL_STUDENT(classId), {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async unenrollStudent(classId: string, studentId: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.CLASSES.UNENROLL_STUDENT(classId, studentId), {
      method: 'DELETE',
    });
  }

  async pauseStudent(classId: string, studentId: string, data?: { reason?: string }): Promise<ApiResponse> {
    const body = data && Object.keys(data).length > 0 ? JSON.stringify(data) : JSON.stringify({});
    return this.request(API_CONFIG.ENDPOINTS.CLASSES.PAUSE_STUDENT(classId, studentId), {
      method: 'POST',
      body,
    });
  }

  async resumeStudent(classId: string, studentId: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.CLASSES.RESUME_STUDENT(classId, studentId), {
      method: 'POST',
    });
  }

  // Students methods
  async getStudents(filters?: { per_page?: number; page?: number; status?: string; search?: string; class_id?: string }): Promise<ApiResponse> {
    const params = new URLSearchParams();
    if (filters?.per_page) params.append('per_page', filters.per_page.toString());
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.status) params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.class_id) params.append('class_id', filters.class_id.toString());

    const queryString = params.toString();
    const endpoint = queryString ? `${API_CONFIG.ENDPOINTS.STUDENTS.LIST}?${queryString}` : API_CONFIG.ENDPOINTS.STUDENTS.LIST;
    return this.request(endpoint);
  }

  async getStudent(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.STUDENTS.SHOW(id));
  }

  async createStudent(studentData: {
    name: string;
    email?: string;
    phone?: string;
    password?: string;
    password_confirmation?: string;
  }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.STUDENTS.CREATE, {
      method: 'POST',
      body: JSON.stringify(studentData),
    });
  }

  async resetStudentPassword(id: string, data: { password: string; password_confirmation: string }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.STUDENTS.RESET_PASSWORD(id), {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateStudent(id: string, studentData: {
    name?: string;
    email?: string;
    phone?: string;
    status?: 'active' | 'inactive';
  }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.STUDENTS.UPDATE(id), {
      method: 'PUT',
      body: JSON.stringify(studentData),
    });
  }

  async deleteStudent(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.STUDENTS.DELETE(id), {
      method: 'DELETE',
    });
  }

  async lockStudent(id: string, lockData: {
    type: 'login' | 'actions' | 'all';
    reason?: string;
    start_at?: string;
    end_at?: string;
  }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.STUDENTS.LOCK(id), {
      method: 'POST',
      body: JSON.stringify(lockData),
    });
  }

  async unlockStudent(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.STUDENTS.UNLOCK(id), {
      method: 'POST',
    });
  }

  async getStudentClasses(
    id: string,
    options?: { page?: number; per_page?: number; status?: string; class_id?: string | number; date_from?: string; date_to?: string }
  ): Promise<ApiResponse> {
    const endpoint = this.buildEndpointWithQuery(
      API_CONFIG.ENDPOINTS.STUDENTS.CLASSES(id),
      options,
      { excludeValues: ['all', ''] }
    );
    return this.request(endpoint);
  }

  async getStudentAssignments(
    id: string,
    options?: { page?: number; per_page?: number; status?: string; class_id?: string | number; date_from?: string; date_to?: string }
  ): Promise<ApiResponse> {
    const endpoint = this.buildEndpointWithQuery(
      API_CONFIG.ENDPOINTS.STUDENTS.ASSIGNMENTS(id),
      options,
      { excludeValues: ['all', ''] }
    );
    return this.request(endpoint);
  }

  async getStudentAttendance(
    id: string,
    options?: { page?: number; per_page?: number; status?: string; class_id?: string | number; date_from?: string; date_to?: string }
  ): Promise<ApiResponse> {
    const endpoint = this.buildEndpointWithQuery(
      API_CONFIG.ENDPOINTS.STUDENTS.ATTENDANCE(id),
      options,
      { excludeValues: ['all', ''] }
    );
    return this.request(endpoint);
  }

  async getStudentGrades(
    id: string,
    options?: { page?: number; per_page?: number; status?: string; class_id?: string | number; date_from?: string; date_to?: string }
  ): Promise<ApiResponse> {
    const endpoint = this.buildEndpointWithQuery(
      API_CONFIG.ENDPOINTS.STUDENTS.GRADES(id),
      options,
      { excludeValues: ['all', ''] }
    );
    return this.request(endpoint);
  }

  async getStudentRecentActivity(id: string, options?: { limit?: number; page?: number; per_page?: number }): Promise<ApiResponse> {
    const params = new URLSearchParams();
    if (options?.limit) {
      params.append('limit', options.limit.toString());
    }
    if (options?.page) {
      params.append('page', options.page.toString());
    }
    if (options?.per_page) {
      params.append('per_page', options.per_page.toString());
    }
    const queryString = params.toString();
    const url = queryString
      ? `${API_CONFIG.ENDPOINTS.STUDENTS.RECENT_ACTIVITY(id)}?${queryString}`
      : API_CONFIG.ENDPOINTS.STUDENTS.RECENT_ACTIVITY(id);
    return this.request(url);
  }

  async getStudentStatistics(
    id: string,
    filters?: { class_id?: string | number; date_from?: string; date_to?: string }
  ): Promise<ApiResponse> {
    const endpoint = this.buildEndpointWithQuery(
      API_CONFIG.ENDPOINTS.STUDENTS.STATISTICS(id),
      filters,
      { excludeValues: ['all', ''] }
    );
    return this.request(endpoint);
  }

  // Schedules methods
  async getSchedules(filters?: {
    per_page?: number;
    page?: number;
    status?: string;
    class_id?: string;
    search?: string;
    mode?: string;
  }): Promise<ApiResponse> {
    const endpoint = this.buildEndpointWithQuery(
      API_CONFIG.ENDPOINTS.SCHEDULES.LIST,
      filters,
      { excludeValues: ['all', ''] }
    );
    return this.request(endpoint);
  }

  async getSchedule(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.SCHEDULES.SHOW(id));
  }

  async createSchedule(scheduleData: {
    class_id: string;
    title: string;
    description?: string;
    start_date: string;
    end_date: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    days_of_week?: number[];
    time_slots: string[];
  }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.SCHEDULES.CREATE, {
      method: 'POST',
      body: JSON.stringify(scheduleData),
    });
  }

  async updateSchedule(id: string, scheduleData: {
    title?: string;
    description?: string;
    start_date?: string;
    end_date?: string;
    frequency?: 'daily' | 'weekly' | 'monthly';
    days_of_week?: number[];
    time_slots?: string[];
    status?: 'active' | 'inactive';
  }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.SCHEDULES.UPDATE(id), {
      method: 'PUT',
      body: JSON.stringify(scheduleData),
    });
  }

  async deleteSchedule(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.SCHEDULES.DELETE(id), {
      method: 'DELETE',
    });
  }

  async generateScheduleSessions(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.SCHEDULES.GENERATE_SESSIONS(id), {
      method: 'POST',
    });
  }

  async getScheduleSessions(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.SCHEDULES.SESSIONS(id));
  }

  async toggleScheduleMode(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.SCHEDULES.TOGGLE_MODE(id), {
      method: 'PUT',
    });
  }

  // Schedule Sessions
  async getScheduleSession(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.SCHEDULE_SESSIONS.SHOW(id));
  }

  async updateScheduleSession(id: string, data: any): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.SCHEDULE_SESSIONS.UPDATE(id), {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteScheduleSession(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.SCHEDULE_SESSIONS.DELETE(id), {
      method: 'DELETE',
    });
  }

  async completeScheduleSession(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.SCHEDULE_SESSIONS.COMPLETE(id), {
      method: 'POST',
    });
  }

  async cancelScheduleSession(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.SCHEDULE_SESSIONS.CANCEL(id), {
      method: 'POST',
    });
  }

  async rescheduleSession(id: string, data: {
    session_date: string;
    start_time: string;
    end_time: string;
    status?: 'scheduled' | 'postponed';
  }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.SCHEDULE_SESSIONS.RESCHEDULE(id), {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Attendance methods
  async getAttendance(filters?: {
    per_page?: number;
    page?: number;
    class_id?: string | number;
    student_id?: string | number;
    date_from?: string;
    date_to?: string;
    status?: string;
    search?: string;
  }): Promise<ApiResponse> {
    const params = new URLSearchParams();
    if (filters?.per_page) params.append('per_page', filters.per_page.toString());
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.class_id) params.append('class_id', filters.class_id.toString());
    if (filters?.student_id) params.append('student_id', filters.student_id.toString());
    if (filters?.date_from) params.append('date_from', filters.date_from);
    if (filters?.date_to) params.append('date_to', filters.date_to);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);

    const queryString = params.toString();
    const endpoint = queryString ? `${API_CONFIG.ENDPOINTS.ATTENDANCE.LIST}?${queryString}` : API_CONFIG.ENDPOINTS.ATTENDANCE.LIST;
    return this.request(endpoint);
  }

  async getAttendanceById(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.ATTENDANCE.SHOW(id));
  }

  async createAttendance(attendanceData: {
    class_id: string;
    date: string;
    attendances: Array<{
      student_id: string;
      status: 'present' | 'absent' | 'late' | 'excused';
      check_in_time?: string | null;
      check_out_time?: string | null;
      note?: string | null;
    }>;
  }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.ATTENDANCE.CREATE, {
      method: 'POST',
      body: JSON.stringify(attendanceData),
    });
  }

  async updateAttendance(id: string, attendanceData: {
    status?: 'present' | 'absent' | 'late' | 'excused';
    check_in_time?: string | null;
    check_out_time?: string | null;
    note?: string | null;
  }): Promise<ApiResponse> {
    // Map legacy 'notes' to 'note' if provided
    const data: any = { ...attendanceData };
    if (data.notes !== undefined && !data.note) {
      data.note = data.notes;
      delete data.notes;
    }
    return this.request(API_CONFIG.ENDPOINTS.ATTENDANCE.UPDATE(id), {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getAttendanceStatusOptions(): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.ATTENDANCE.STATUS_OPTIONS);
  }

  async deleteAttendance(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.ATTENDANCE.DELETE(id), {
      method: 'DELETE',
    });
  }

  async getAttendanceByClass(classId: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.ATTENDANCE.BY_CLASS(classId));
  }

  async getAttendanceByStudent(studentId: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.ATTENDANCE.BY_STUDENT(studentId));
  }

  async bulkUpdateAttendance(attendanceData: {
    updates: Array<{
      id: string | number;
      status?: 'present' | 'absent' | 'late' | 'excused';
      check_in_time?: string | null;
      check_out_time?: string | null;
      note?: string | null;
    }>;
  }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.ATTENDANCE.BULK_UPDATE, {
      method: 'POST',
      body: JSON.stringify(attendanceData),
    });
  }

  // QR attendance methods
  // Bắt đầu phiên QR điểm danh cho một buổi học (đặt buổi học sang trạng thái đang diễn ra)
  async startAttendanceQr(sessionId: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.SCHEDULE_SESSIONS.ATTENDANCE_START(sessionId), {
      method: 'POST',
    });
  }

  // Lấy token QR mới (xoay vòng) để làm mới mã QR
  async getAttendanceQrToken(sessionId: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.SCHEDULE_SESSIONS.ATTENDANCE_TOKEN(sessionId));
  }

  // Lấy dữ liệu điểm danh trực tiếp (danh sách học viên + số liệu) để poll
  async getAttendanceLive(sessionId: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.SCHEDULE_SESSIONS.ATTENDANCE_LIVE(sessionId));
  }

  // Học viên điểm danh bằng token (quét QR) hoặc code (nhập tay)
  async checkInAttendance(body: { token?: string; code?: string }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.ATTENDANCE.CHECK_IN, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // Assignments methods
  async getAssignments(filters?: { per_page?: number; page?: number; status?: string; class_id?: string | number; search?: string }): Promise<ApiResponse> {
    const params = new URLSearchParams();
    if (filters?.per_page) params.append('per_page', filters.per_page.toString());
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.status) params.append('status', filters.status);
    if (filters?.class_id) params.append('class_id', filters.class_id.toString());
    if (filters?.search) params.append('search', filters.search);

    const queryString = params.toString();
    const endpoint = queryString ? `${API_CONFIG.ENDPOINTS.ASSIGNMENTS.LIST}?${queryString}` : API_CONFIG.ENDPOINTS.ASSIGNMENTS.LIST;
    return this.request(endpoint);
  }

  async getAssignment(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.ASSIGNMENTS.SHOW(id));
  }

  async createAssignment(assignmentData: {
    class_id: string | number;
    assignment_type_id: string | number;
    title: string;
    description?: string;
    instructions?: string;
    max_score: number;
    assigned_date?: string;
    due_date?: string;
    deadline?: string;
    allow_late_submission?: boolean;
    status: 'draft' | 'published' | 'closed';
    learning_resources?: (string | number)[];
    allowed_submission_types?: ('text' | 'file' | 'document' | 'image' | 'video' | 'audio' | 'link' | 'quiz')[];
    mode?: 'standard' | 'quiz';
    quiz_settings?: QuizSettings | null;
    questions?: QuizQuestion[];
    max_attempts?: number | null;
  }): Promise<ApiResponse> {
    const endpoint = API_CONFIG.ENDPOINTS.ASSIGNMENTS.CREATE;
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(assignmentData),
    });
  }

  async updateAssignment(id: string, assignmentData: {
    class_id?: string | number;
    assignment_type_id?: string | number;
    title?: string;
    description?: string;
    instructions?: string;
    max_score?: number;
    assigned_date?: string;
    due_date?: string;
    deadline?: string;
    allow_late_submission?: boolean;
    status?: 'draft' | 'published' | 'closed';
    learning_resources?: (string | number)[];
    allowed_submission_types?: ('text' | 'file' | 'document' | 'image' | 'video' | 'audio' | 'link' | 'quiz')[];
    mode?: 'standard' | 'quiz';
    quiz_settings?: QuizSettings | null;
    questions?: QuizQuestion[];
    max_attempts?: number | null;
  }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.ASSIGNMENTS.UPDATE(id), {
      method: 'PUT',
      body: JSON.stringify(assignmentData),
    });
  }

  async deleteAssignment(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.ASSIGNMENTS.DELETE(id), {
      method: 'DELETE',
    });
  }

  async getAssignmentSubmissions(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.ASSIGNMENTS.SUBMISSIONS(id));
  }

  async getAssignmentsByClass(classId: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.ASSIGNMENTS.BY_CLASS(classId));
  }

  async getAssignmentQuizSchema(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.ASSIGNMENTS.QUIZ_SCHEMA(id));
  }

  async getAssignmentQuizForStudent(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.ASSIGNMENTS.QUIZ_TAKE(id));
  }

  // Assignment Types methods
  async getAssignmentTypes(options?: {
    is_active?: boolean;
    search?: string;
    per_page?: number;
    page?: number;
  }): Promise<ApiResponse> {
    const endpoint = this.buildEndpointWithQuery(
      API_CONFIG.ENDPOINTS.ASSIGNMENT_TYPES.LIST,
      options,
      { excludeValues: ['all', ''] }
    );
    return this.request(endpoint);
  }

  async getAssignmentType(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.ASSIGNMENT_TYPES.SHOW(id));
  }

  async createAssignmentType(data: {
    name: string;
    code?: string;
    description?: string;
    is_active?: boolean;
    order?: number;
  }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.ASSIGNMENT_TYPES.CREATE, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAssignmentType(id: string, data: {
    name?: string;
    code?: string;
    description?: string;
    is_active?: boolean;
    order?: number;
  }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.ASSIGNMENT_TYPES.UPDATE(id), {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAssignmentType(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.ASSIGNMENT_TYPES.DELETE(id), {
      method: 'DELETE',
    });
  }

  async getGradeTypes(options?: {
    is_active?: boolean;
    search?: string;
    per_page?: number;
    page?: number;
  }): Promise<ApiResponse> {
    const endpoint = this.buildEndpointWithQuery(
      API_CONFIG.ENDPOINTS.GRADE_TYPES.LIST,
      options,
      { excludeValues: ['all', ''] }
    );
    return this.request(endpoint);
  }

  async getGradeType(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.GRADE_TYPES.SHOW(id));
  }

  async createGradeType(data: {
    name: string;
    code?: string;
    description?: string;
    is_active?: boolean;
    order?: number;
    weight?: number;
  }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.GRADE_TYPES.CREATE, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateGradeType(id: string, data: {
    name?: string;
    code?: string;
    description?: string;
    is_active?: boolean;
    order?: number;
    weight?: number;
  }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.GRADE_TYPES.UPDATE(id), {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteGradeType(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.GRADE_TYPES.DELETE(id), {
      method: 'DELETE',
    });
  }

  // Subjects methods
  async getSubjects(options?: {
    is_active?: boolean;
    search?: string;
    sort?: string;
    order?: string;
    per_page?: number;
    page?: number;
  }): Promise<ApiResponse> {
    const endpoint = this.buildEndpointWithQuery(
      API_CONFIG.ENDPOINTS.SUBJECTS.LIST,
      options,
      { excludeValues: ['all', ''] }
    );
    return this.request(endpoint);
  }

  async getSubject(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.SUBJECTS.SHOW(id));
  }

  async createSubject(data: {
    name: string;
    code?: string;
    description?: string;
    is_active?: boolean;
    order?: number;
  }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.SUBJECTS.CREATE, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSubject(id: string, data: {
    name?: string;
    code?: string;
    description?: string;
    is_active?: boolean;
    order?: number;
  }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.SUBJECTS.UPDATE(id), {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSubject(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.SUBJECTS.DELETE(id), {
      method: 'DELETE',
    });
  }

  // Grade Levels methods
  async getGradeLevels(options?: {
    is_active?: boolean;
    search?: string;
    sort?: string;
    order?: string;
    per_page?: number;
    page?: number;
  }): Promise<ApiResponse> {
    const endpoint = this.buildEndpointWithQuery(
      API_CONFIG.ENDPOINTS.GRADE_LEVELS.LIST,
      options,
      { excludeValues: ['all', ''] }
    );

    return this.request(endpoint);
  }

  async getGradeLevel(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.GRADE_LEVELS.SHOW(id));
  }

  async createGradeLevel(data: {
    name: string;
    code?: string;
    description?: string;
    is_active?: boolean;
    order?: number;
  }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.GRADE_LEVELS.CREATE, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateGradeLevel(id: string, data: {
    name?: string;
    code?: string;
    description?: string;
    is_active?: boolean;
    order?: number;
  }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.GRADE_LEVELS.UPDATE(id), {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteGradeLevel(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.GRADE_LEVELS.DELETE(id), {
      method: 'DELETE',
    });
  }

  // Learning Resources methods
  async getLearningResources(options?: {
    type?: string;
    status?: string;
    subject_id?: string;
    grade_level_id?: string;
    is_public?: boolean;
    search?: string;
    tags?: string | string[];
    sort?: string;
    order?: string;
    per_page?: number;
    page?: number;
  }): Promise<ApiResponse> {
    const params = new URLSearchParams();
    if (options?.type) params.append('type', options.type);
    if (options?.status) params.append('status', options.status);
    if (options?.subject_id) params.append('subject_id', options.subject_id.toString());
    if (options?.grade_level_id) params.append('grade_level_id', options.grade_level_id.toString());
    if (options?.is_public !== undefined) params.append('is_public', options.is_public ? '1' : '0');
    if (options?.search) params.append('search', options.search);
    if (options?.tags) {
      const tagsStr = Array.isArray(options.tags) ? options.tags.join(',') : options.tags;
      params.append('tags', tagsStr);
    }
    if (options?.sort) params.append('sort', options.sort);
    if (options?.order) params.append('order', options.order);
    if (options?.per_page) params.append('per_page', options.per_page.toString());
    if (options?.page) params.append('page', options.page.toString());

    const queryString = params.toString();
    const url = queryString
      ? `${API_CONFIG.ENDPOINTS.LEARNING_RESOURCES.LIST}?${queryString}`
      : API_CONFIG.ENDPOINTS.LEARNING_RESOURCES.LIST;
    return this.request(url);
  }

  async getLearningResource(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.LEARNING_RESOURCES.SHOW(id));
  }

  async createLearningResource(data: FormData | {
    title: string;
    description?: string;
    type?: string;
    status?: string;
    subject_id?: string;
    grade_level_id?: string;
    topic?: string;
    tags?: string[];
    external_url?: string;
    is_public?: boolean;
    media_id?: string;
    file?: File;
  }): Promise<ApiResponse> {
    const formData = data instanceof FormData
      ? data
      : this.objectToFormData(data);

    return this.request(API_CONFIG.ENDPOINTS.LEARNING_RESOURCES.CREATE, {
      method: 'POST',
      body: formData,
    });
  }

  async updateLearningResource(id: string, data: FormData | {
    title?: string;
    description?: string;
    type?: string;
    status?: string;
    subject_id?: string;
    grade_level_id?: string;
    topic?: string;
    tags?: string[];
    external_url?: string;
    is_public?: boolean;
    media_id?: string;
    file?: File;
  }): Promise<ApiResponse> {
    const isFormDataInput = data instanceof FormData;
    const hasFile = isFormDataInput ? data.has('file') : (data as any)?.file instanceof File;

    // File upload path: use FormData + method spoofing
    if (hasFile) {
      const formData = isFormDataInput ? data : this.objectToFormData(data);
      if (!formData.has('_method')) {
        formData.append('_method', 'PUT');
      }
      return this.request(API_CONFIG.ENDPOINTS.LEARNING_RESOURCES.UPDATE(id), {
        method: 'POST', // Use POST for Laravel when uploading file
        body: formData,
      });
    }

    // JSON path: avoid sending multipart without file (backend tries to parse JSON)
    const jsonData = isFormDataInput ? Object.fromEntries(data.entries()) : data;
    return this.request(API_CONFIG.ENDPOINTS.LEARNING_RESOURCES.UPDATE(id), {
      method: 'PUT',
      body: JSON.stringify(jsonData),
    });
  }

  async deleteLearningResource(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.LEARNING_RESOURCES.DELETE(id), {
      method: 'DELETE',
    });
  }

  async uploadLearningResourceFile(file: File): Promise<ApiResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return this.request(API_CONFIG.ENDPOINTS.LEARNING_RESOURCES.UPLOAD, {
      method: 'POST',
      body: formData,
    });
  }

  async downloadLearningResource(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.LEARNING_RESOURCES.DOWNLOAD(id));
  }

  /**
   * Download file với authentication và trigger browser download
   * @param url Download URL (Next.js API route hoặc backend URL)
   * @param filename Tên file để download (optional)
   * @returns Promise<void>
   */
  async downloadFile(url: string, filename?: string): Promise<void> {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...this.getAuthHeader(),
        },
        // Include cookies (HttpOnly cookies) automatically
        credentials: 'include',
      });

      if (!response.ok) {
        // Try to parse error response
        try {
          const errorData = await response.json();
          throw new Error(errorData.message || `Download failed: ${response.status} ${response.statusText}`);
        } catch {
          throw new Error(`Download failed: ${response.status} ${response.statusText}`);
        }
      }

      // Get blob from response
      const blob = await response.blob();

      // Get filename from Content-Disposition header or use provided filename
      let downloadFilename = filename;
      if (!downloadFilename) {
        const contentDisposition = response.headers.get('content-disposition');
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
          if (filenameMatch && filenameMatch[1]) {
            downloadFilename = filenameMatch[1].replace(/['"]/g, '');
            // Decode URI if needed
            try {
              downloadFilename = decodeURIComponent(downloadFilename);
            } catch {
              // Keep original if decode fails
            }
          }
        }
      }

      // Formatted date string: DD-MM-YYYY
      const now = new Date();
      const dateStr = `${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getFullYear()}`;

      // Append date to filename if it exists
      if (downloadFilename) {
        const lastDotIndex = downloadFilename.lastIndexOf('.');
        if (lastDotIndex !== -1) {
          // Insert date before extension: filename_DD-MM-YYYY.ext
          const name = downloadFilename.substring(0, lastDotIndex);
          const ext = downloadFilename.substring(lastDotIndex);
          downloadFilename = `${name}-${dateStr}${ext}`;
        } else {
          // No extension: filename_DD-MM-YYYY
          downloadFilename = `${downloadFilename}-${dateStr}`;
        }
      } else {
        // Fallback: download_DD-MM-YYYY
        downloadFilename = `download-${dateStr}`;
      }

      // Use safe download that works in Zalo and other mobile apps
      const { safeDownload } = await import('@/lib/zalo-utils');
      safeDownload(blob, downloadFilename);
    } catch (error) {
      throw error;
    }
  }

  async uploadMediaFile(file: File, type?: 'audio' | 'image' | 'video' | 'document' | 'file'): Promise<ApiResponse> {
    const formData = new FormData();
    formData.append('file', file);
    if (type) {
      formData.append('type', type);
    }

    return this.request(API_CONFIG.ENDPOINTS.MEDIA.UPLOAD, {
      method: 'POST',
      body: formData,
    });
  }

  // Helper method to convert object to FormData
  private objectToFormData(obj: any): FormData {
    const formData = new FormData();

    // Check if obj is null or undefined
    if (!obj || typeof obj !== 'object') {
      return formData; // Return empty FormData if obj is invalid
    }

    try {
      Object.keys(obj).forEach(key => {
        const value = obj[key];

        // Skip undefined/null values
        if (value === undefined || value === null) {
          return;
        }

        try {
          if (value instanceof File) {
            formData.append(key, value);
          } else if (Array.isArray(value)) {
            // Handle arrays (like tags)
            if (key === 'tags' && value.length > 0) {
              value.forEach((tag, index) => {
                if (tag !== null && tag !== undefined) {
                  formData.append(`${key}[${index}]`, String(tag));
                }
              });
            } else if (value.length > 0) {
              value.forEach((item, index) => {
                if (item !== null && item !== undefined) {
                  formData.append(`${key}[${index}]`, String(item));
                }
              });
            }
          } else {
            // Convert to string safely
            const stringValue = String(value);
            if (stringValue !== 'null' && stringValue !== 'undefined') {
              formData.append(key, stringValue);
            }
          }
        } catch {
          // Skip this field if append fails
        }
      });
    } catch (error) {
      console.error('Error converting object to FormData:', error);
      // Return empty FormData if conversion fails
    }

    return formData;
  }

  // Submissions methods
  async getSubmissions(filters?: { per_page?: number; page?: number; assignment_id?: string; student_id?: string; status?: string; search?: string }): Promise<ApiResponse> {
    const params = new URLSearchParams();
    if (filters?.per_page) params.append('per_page', filters.per_page.toString());
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.assignment_id) params.append('assignment_id', filters.assignment_id.toString());
    if (filters?.student_id) params.append('student_id', filters.student_id.toString());
    if (filters?.status) params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);

    const queryString = params.toString();
    const endpoint = queryString ? `${API_CONFIG.ENDPOINTS.SUBMISSIONS.LIST}?${queryString}` : API_CONFIG.ENDPOINTS.SUBMISSIONS.LIST;
    return this.request(endpoint);
  }

  async getSubmission(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.SUBMISSIONS.SHOW(id));
  }

  /**
   * Full quiz paper review for one submission: {submission, assignment, sections, questions,
   * responses, expose_correct}. Works for the owning student AND staff (answer key gated by
   * quiz_settings.show_correct_answers server-side).
   */
  async getSubmissionReview(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.SUBMISSIONS.REVIEW(id));
  }

  /**
   * Tutor skill dashboard: per-student earned/possible points bucketed by section_type.
   * Staff-only on the backend (enrolled students get a 404).
   */
  async getAssignmentSkillReport(assignmentId: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.ASSIGNMENTS.SKILL_REPORT(assignmentId));
  }

  async createSubmission(submissionData: {
    assignment_id: string;
    student_id?: string;
    content?: string;
    media_id?: string;
    external_url?: string;
    started_at?: string; // ISO string for quiz timing
    answers?: Array<{
      question_id: string;
      option_id: string | null;
    }>;
  }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.SUBMISSIONS.CREATE, {
      method: 'POST',
      body: JSON.stringify(submissionData),
    });
  }

  async updateSubmission(id: string, submissionData: {
    content?: string;
    media_id?: string;
    external_url?: string;
  }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.SUBMISSIONS.UPDATE(id), {
      method: 'PUT',
      body: JSON.stringify(submissionData),
    });
  }

  async deleteSubmission(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.SUBMISSIONS.DELETE(id), {
      method: 'DELETE',
    });
  }

  async gradeSubmission(id: string, gradeData: {
    score: number;
    feedback?: string;
  }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.SUBMISSIONS.GRADE(id), {
      method: 'POST',
      body: JSON.stringify(gradeData),
    });
  }

  /**
   * AI grading suggestion (Pro). Advisory only — stores ai_suggested_score/ai_feedback,
   * never the real score. No request body. Can take several seconds (calls the AI upstream).
   */
  async aiGradeSubmission(submissionId: string): Promise<ApiResponse<AiGradeResult>> {
    return this.request<AiGradeResult>(API_CONFIG.ENDPOINTS.SUBMISSIONS.AI_GRADE(submissionId), {
      method: 'POST',
    });
  }

  /**
   * Accept an AI grading suggestion as the official grade (Pro). Optional body overrides the
   * suggested score/feedback with the tutor's edits; omit to accept the suggestion as-is.
   * Returns the updated (graded) submission.
   */
  async acceptAiGrade(
    submissionId: string,
    payload?: { score?: number; feedback?: string }
  ): Promise<ApiResponse<Submission>> {
    return this.request<Submission>(API_CONFIG.ENDPOINTS.SUBMISSIONS.AI_GRADE_ACCEPT(submissionId), {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    });
  }

  /**
   * AI question generation (Pro). Returns generated questions for review — nothing is saved
   * until the tutor saves the quiz through the normal flow.
   */
  async aiGenerateQuestions(
    assignmentId: string,
    payload: AiGenerateQuestionsRequest
  ): Promise<ApiResponse<AiGenerateQuestionsResult>> {
    return this.request<AiGenerateQuestionsResult>(
      API_CONFIG.ENDPOINTS.ASSIGNMENTS.AI_GENERATE_QUESTIONS(assignmentId),
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  }

  async getLatestSubmission(assignmentId: string): Promise<ApiResponse> {
    const response = await this.request(API_CONFIG.ENDPOINTS.SUBMISSIONS.LATEST(assignmentId));

    // Handle 404 as valid state (no submission yet) - not an error
    // Backend returns: { success: false, message: "Chưa có bài nộp nào", code: "NOT_FOUND", status_code: 404 }
    if (!response.success && response.code === 'NOT_FOUND' && response.message?.includes('Chưa có bài nộp')) {
      return {
        success: true,
        data: null,
        message: response.message,
      };
    }

    return response;
  }

  async getSubmissionHistory(assignmentId: string, studentId?: string): Promise<ApiResponse> {
    const url = studentId
      ? `${API_CONFIG.ENDPOINTS.SUBMISSIONS.HISTORY(assignmentId)}?student_id=${studentId}`
      : API_CONFIG.ENDPOINTS.SUBMISSIONS.HISTORY(assignmentId);
    return this.request(url);
  }

  // Grades methods
  async getGrades(filters?: { per_page?: number; page?: number; class_id?: string; student_id?: string; assignment_id?: string; search?: string }): Promise<ApiResponse> {
    const params = new URLSearchParams();
    if (filters?.per_page) params.append('per_page', filters.per_page.toString());
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.class_id) params.append('class_id', filters.class_id.toString());
    if (filters?.student_id) params.append('student_id', filters.student_id.toString());
    if (filters?.assignment_id) params.append('assignment_id', filters.assignment_id.toString());
    if (filters?.search) params.append('search', filters.search);

    const queryString = params.toString();
    const endpoint = queryString ? `${API_CONFIG.ENDPOINTS.GRADES.LIST}?${queryString}` : API_CONFIG.ENDPOINTS.GRADES.LIST;
    return this.request(endpoint);
  }

  async getGrade(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.GRADES.SHOW(id));
  }

  async createGrade(gradeData: {
    class_id: string;
    student_id: string;
    assignment_id?: string;
    grade_type_id?: string;
    title: string;
    score: number;
    max_score?: number;
    comments?: string;
    grade_date?: string;
    semester?: string;
    // Legacy fields for backward compatibility
    grade?: number;
    max_points?: number;
  }): Promise<ApiResponse> {
    // Map legacy fields if provided
    const data: any = { ...gradeData };
    if (data.grade !== undefined && !data.score) {
      data.score = data.grade;
      delete data.grade;
    }
    if (data.max_points !== undefined && !data.max_score) {
      data.max_score = data.max_points;
      delete data.max_points;
    }
    return this.request(API_CONFIG.ENDPOINTS.GRADES.CREATE, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateGrade(id: string, gradeData: {
    title?: string;
    score?: number;
    max_score?: number;
    comments?: string;
    grade_date?: string;
    semester?: string;
    // Legacy fields for backward compatibility
    grade?: number;
    max_points?: number;
  }): Promise<ApiResponse> {
    // Map legacy fields if provided
    const data: any = { ...gradeData };
    if (data.grade !== undefined && !data.score) {
      data.score = data.grade;
      delete data.grade;
    }
    if (data.max_points !== undefined && !data.max_score) {
      data.max_score = data.max_points;
      delete data.max_points;
    }
    return this.request(API_CONFIG.ENDPOINTS.GRADES.UPDATE(id), {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteGrade(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.GRADES.DELETE(id), {
      method: 'DELETE',
    });
  }

  async getGradesByClass(classId: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.GRADES.BY_CLASS(classId));
  }

  async getGradesByStudent(studentId: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.GRADES.BY_STUDENT(studentId));
  }

  // Whole-class gradebook grid (rows = students, columns = grade types).
  async getGradebook(classId: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.GRADES.GRADEBOOK(classId));
  }

  // Printable per-student report card (grades by type + weighted average + attendance).
  async getReportCard(classId: string, studentId: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.GRADES.REPORT_CARD(classId, studentId));
  }

  // All-or-nothing bulk upsert of grade cells (one grade per class+student+grade_type).
  async bulkStoreGrades(data: {
    class_id: string;
    grades: Array<{
      student_id: string;
      grade_type_id?: string | null;
      score: number;
      max_score?: number;
      title?: string;
      comment?: string;
    }>;
  }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.GRADES.BULK, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Lesson Notes methods
  async getLessonNotes(filters?: { per_page?: number; page?: number; class_id?: string; search?: string; date_from?: string; date_to?: string }): Promise<ApiResponse> {
    const params = new URLSearchParams();
    if (filters?.per_page) params.append('per_page', filters.per_page.toString());
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.class_id) params.append('class_id', filters.class_id.toString());
    if (filters?.search) params.append('search', filters.search);
    if (filters?.date_from) params.append('date_from', filters.date_from);
    if (filters?.date_to) params.append('date_to', filters.date_to);

    const queryString = params.toString();
    const endpoint = queryString ? `${API_CONFIG.ENDPOINTS.LESSON_NOTES.LIST}?${queryString}` : API_CONFIG.ENDPOINTS.LESSON_NOTES.LIST;
    return this.request(endpoint);
  }

  async getLessonNote(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.LESSON_NOTES.SHOW(id));
  }

  async createLessonNote(lessonNoteData: {
    class_id: string;
    lesson_date: string;
    topic?: string;
    content: string;
    observations?: string;
    student_notes?: Array<{
      student_id: string | number;
      behavior: 'excellent' | 'good' | 'average' | 'poor';
      note?: string;
    }>;
    learning_resources?: (string | number)[];
    attachments?: (string | number)[];
    // Legacy fields
    title?: string;
    date?: string;
  }): Promise<ApiResponse> {
    // Map legacy 'date' to 'lesson_date' if provided
    const data: any = { ...lessonNoteData };
    if (data.date && !data.lesson_date) {
      data.lesson_date = data.date;
      delete data.date;
    }
    return this.request(API_CONFIG.ENDPOINTS.LESSON_NOTES.CREATE, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLessonNote(id: string, lessonNoteData: {
    lesson_date?: string;
    topic?: string;
    content?: string;
    observations?: string;
    student_notes?: Array<{
      student_id: string | number;
      behavior: 'excellent' | 'good' | 'average' | 'poor';
      note?: string;
    }>;
    learning_resources?: (string | number)[];
    attachments?: (string | number)[];
    // Legacy fields
    title?: string;
    date?: string;
  }): Promise<ApiResponse> {
    // Map legacy 'date' to 'lesson_date' if provided
    const data: any = { ...lessonNoteData };
    if (data.date && !data.lesson_date) {
      data.lesson_date = data.date;
      delete data.date;
    }
    return this.request(API_CONFIG.ENDPOINTS.LESSON_NOTES.UPDATE(id), {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteLessonNote(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.LESSON_NOTES.DELETE(id), {
      method: 'DELETE',
    });
  }

  async getLessonNotesByClass(classId: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.LESSON_NOTES.BY_CLASS(classId));
  }

  // Payments methods
  async getPayments(filters?: {
    class_id?: string;
    student_id?: string;
    status?: string;
    payment_method?: string;
    date_from?: string;
    date_to?: string;
    per_page?: number;
    page?: number;
    sort?: string;
    order?: string;
    search?: string;
  }): Promise<ApiResponse> {
    const params = new URLSearchParams();
    if (filters?.class_id) params.append('class_id', filters.class_id.toString());
    if (filters?.student_id) params.append('student_id', filters.student_id.toString());
    if (filters?.status) params.append('status', filters.status);
    if (filters?.payment_method) params.append('payment_method', filters.payment_method);
    if (filters?.date_from) params.append('date_from', filters.date_from);
    if (filters?.date_to) params.append('date_to', filters.date_to);
    if (filters?.per_page) params.append('per_page', filters.per_page.toString());
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.sort) params.append('sort', filters.sort);
    if (filters?.order) params.append('order', filters.order);
    if (filters?.search) params.append('search', filters.search);

    const queryString = params.toString();
    const endpoint = queryString ? `${API_CONFIG.ENDPOINTS.PAYMENTS.LIST}?${queryString}` : API_CONFIG.ENDPOINTS.PAYMENTS.LIST;
    return this.request(endpoint);
  }

  async getPayment(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.PAYMENTS.SHOW(id));
  }

  async createPayment(paymentData: {
    class_id: string;
    student_id: string;
    month: string; // Required
    amount?: number;
    payment_date?: string;
    due_date?: string;
    payment_method?: 'cash' | 'bank' | 'other';
    status?: 'paid' | 'pending' | 'failed' | 'refunded';
    note?: string;
    payment_request_id?: string; // Link to payment request
    // Legacy fields for backward compatibility
    invoice_number?: string;
    customer_id?: number;
    notes?: string;
  }): Promise<ApiResponse> {
    // Map legacy fields if provided
    const data: any = { ...paymentData };
    if (data.notes && !data.note) {
      data.note = data.notes;
    }
    if (data.notes) delete data.notes;
    // customer_id will be set automatically by backend from auth user
    if (data.customer_id) delete data.customer_id;

    return this.request(API_CONFIG.ENDPOINTS.PAYMENTS.CREATE, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePayment(id: string, paymentData: {
    month?: string;
    amount?: number;
    payment_date?: string;
    due_date?: string;
    payment_method?: 'cash' | 'bank' | 'other';
    status?: 'paid' | 'pending' | 'failed' | 'refunded';
    note?: string;
    // Legacy fields for backward compatibility
    invoice_number?: string;
    notes?: string;
  }): Promise<ApiResponse> {
    // Map legacy fields if provided
    const data: any = { ...paymentData };
    if (data.notes && !data.note) {
      data.note = data.notes;
    }
    if (data.notes) delete data.notes;

    return this.request(API_CONFIG.ENDPOINTS.PAYMENTS.UPDATE(id), {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePayment(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.PAYMENTS.DELETE(id), {
      method: 'DELETE',
    });
  }

  async getPaymentsByStudent(
    studentId: string,
    filters?: {
      per_page?: number;
      page?: number;
      status?: string;
      payment_method?: string;
      class_id?: string;
      date_from?: string;
      date_to?: string;
      search?: string;
      sort?: string;
      order?: string;
    }
  ): Promise<ApiResponse> {
    const baseUrl = API_CONFIG.ENDPOINTS.PAYMENTS.BY_STUDENT(studentId);

    // Build query string similar to other list endpoints
    const params = new URLSearchParams();
    if (filters?.per_page) params.append("per_page", filters.per_page.toString());
    if (filters?.page) params.append("page", filters.page.toString());
    if (filters?.status) params.append("status", filters.status);
    if (filters?.payment_method) params.append("payment_method", filters.payment_method);
    if (filters?.class_id) params.append("class_id", filters.class_id.toString());
    if (filters?.date_from) params.append("date_from", filters.date_from);
    if (filters?.date_to) params.append("date_to", filters.date_to);
    if (filters?.search) params.append("search", filters.search);
    if (filters?.sort) params.append("sort", filters.sort);
    if (filters?.order) params.append("order", filters.order);

    const queryString = params.toString();
    const url = queryString ? `${baseUrl}?${queryString}` : baseUrl;

    return this.request(url);
  }

  async getPaymentStatistics(filters?: PaymentStatisticsFilters): Promise<ApiResponse> {
    // Period chỉ được thêm nếu không có date_from và date_to
    const processedFilters = { ...filters };
    if (processedFilters?.period && (processedFilters.date_from || processedFilters.date_to)) {
      delete processedFilters.period;
    }

    const endpoint = this.buildEndpointWithQuery(
      API_CONFIG.ENDPOINTS.PAYMENTS.STATISTICS,
      processedFilters,
      { excludeValues: ['all'] }
    );
    return this.request(endpoint);
  }

  async approvePayment(id: string, data?: { note?: string }): Promise<ApiResponse> {
    const body: Record<string, any> = {};
    if (data?.note) {
      body.note = data.note;
    }
    return this.request(API_CONFIG.ENDPOINTS.PAYMENTS.APPROVE(id), {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async rejectPayment(id: string, data: { reason: string }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.PAYMENTS.REJECT(id), {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async refundPayment(id: string, data: { reason: string; refund_amount?: number }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.PAYMENTS.REFUND(id), {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async markPaymentFailed(id: string, data: { reason: string }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.PAYMENTS.MARK_FAILED(id), {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Payment Requests methods
  async getPaymentRequests(classId: string, filters?: { status?: string; period_month?: string; per_page?: number; page?: number }): Promise<ApiResponse> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.period_month) params.append('period_month', filters.period_month);
    if (filters?.per_page) params.append('per_page', filters.per_page.toString());
    if (filters?.page) params.append('page', filters.page.toString());

    const queryString = params.toString();
    const endpoint = queryString ? `${API_CONFIG.ENDPOINTS.PAYMENT_REQUESTS.LIST(classId)}?${queryString}` : API_CONFIG.ENDPOINTS.PAYMENT_REQUESTS.LIST(classId);
    return this.request(endpoint);
  }

  async getPaymentRequest(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.PAYMENT_REQUESTS.SHOW(id));
  }

  async createPaymentRequest(classId: string, data: {
    period_name: string;
    period_month?: string;
    amount_per_student: number;
    due_date: string;
    description?: string;
    auto_create_payments?: boolean;
  }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.PAYMENT_REQUESTS.CREATE(classId), {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async bulkCreatePaymentRequests(classId: string, data: {
    amount_per_student: number;
    start_date: string;
    number_of_periods: number;
    period_type: 'monthly' | 'weekly' | 'custom';
    period_name_template?: string;
    description?: string;
    auto_create_payments?: boolean;
  }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.PAYMENT_REQUESTS.BULK_CREATE(classId), {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePaymentRequest(id: string, data: {
    period_name?: string;
    period_month?: string;
    amount_per_student?: number;
    due_date?: string;
    description?: string;
    status?: 'pending' | 'active' | 'cancelled';
  }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.PAYMENT_REQUESTS.UPDATE(id), {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePaymentRequest(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.PAYMENT_REQUESTS.DELETE(id), {
      method: 'DELETE',
    });
  }

  async getPaymentRequestStatistics(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.PAYMENT_REQUESTS.STATISTICS(id));
  }

  // Notifications methods
  async getNotifications(filters?: {
    per_page?: number;
    page?: number;
    type?: string;
    status?: string;
    target?: string;
    search?: string;
    read?: boolean;
    unread?: boolean;
  }): Promise<ApiResponse> {
    const params = new URLSearchParams();
    if (filters?.per_page) params.append('per_page', filters.per_page.toString());
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.type) params.append('type', filters.type);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.target) params.append('target', filters.target);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.read) params.append('read', '1');
    if (filters?.unread) params.append('unread', '1');

    const queryString = params.toString();
    const endpoint = queryString ? `${API_CONFIG.ENDPOINTS.NOTIFICATIONS.LIST}?${queryString}` : API_CONFIG.ENDPOINTS.NOTIFICATIONS.LIST;
    return this.request(endpoint);
  }

  async getNotification(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.NOTIFICATIONS.SHOW(id));
  }

  async createNotification(notificationData: {
    title: string;
    content: string;
    type: 'announcement' | 'reminder' | 'payment' | 'attendance' | 'grade' | 'other';
    target: 'student' | 'parent' | 'all';
    channel: 'email' | 'zalo' | 'sms' | 'in_app';
    scheduled_at?: string;
    recipient_classes?: (string | number)[];
    recipient_students?: (string | number)[];
    // Legacy fields for backward compatibility
    channels?: string[];
  }): Promise<ApiResponse> {
    // Map FE fields -> backend expected fields
    const data: any = { ...notificationData };

    // Backend requires "message" instead of "content"
    if (data.content && !data.message) {
      data.message = data.content;
    }

    // recipient_type is now explicitly set by user in the form
    // No automatic inference needed

    // Map legacy channels to channel if needed
    if (data.channels && data.channels.length > 0 && !data.channel) {
      // Use first channel as primary if channel not specified
      data.channel = data.channels[0] as 'email' | 'zalo' | 'sms' | 'in_app';
    }
    // Remove channels if channel is provided
    if (data.channel) {
      delete data.channels;
    }

    return this.request(API_CONFIG.ENDPOINTS.NOTIFICATIONS.CREATE, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getNotificationRecipients(
    id: string,
    filters?: { status?: 'pending' | 'sent' | 'failed' | 'skipped'; per_page?: number; page?: number }
  ): Promise<ApiResponse> {
    const endpoint = this.buildEndpointWithQuery(
      `${API_CONFIG.ENDPOINTS.NOTIFICATIONS.SHOW(id)}/recipients`,
      filters,
      { excludeValues: ['all', ''] }
    );
    return this.request(endpoint);
  }

  async sendNotificationEmailBatch(
    id: string,
    data?: { recipient_ids?: string[]; recipient_student_ids?: string[] }
  ): Promise<ApiResponse> {
    return this.request(`${API_CONFIG.ENDPOINTS.NOTIFICATIONS.SHOW(id)}/send-email-batch`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  }

  async resendFailedNotificationEmails(
    id: string,
    data?: { batch_size?: number }
  ): Promise<ApiResponse> {
    return this.request(`${API_CONFIG.ENDPOINTS.NOTIFICATIONS.SHOW(id)}/resend-failed`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  }

  async updateNotification(id: string, notificationData: {
    title?: string;
    content?: string;
    type?: 'announcement' | 'reminder' | 'payment' | 'attendance' | 'grade' | 'other';
    target?: 'student' | 'parent' | 'all';
    channel?: 'email' | 'zalo' | 'sms' | 'in_app';
    scheduled_at?: string;
    status?: 'draft' | 'scheduled' | 'processing' | 'sent' | 'failed';
    recipient_classes?: (string | number)[];
    recipient_students?: (string | number)[];
    // Legacy fields for backward compatibility
    channels?: string[];
  }): Promise<ApiResponse> {
    // Map legacy channels to channel if needed
    const data: any = { ...notificationData };
    if (data.channels && data.channels.length > 0 && !data.channel) {
      data.channel = data.channels[0] as 'email' | 'zalo' | 'sms' | 'in_app';
    }
    // Remove channels if channel is provided
    if (data.channel) {
      delete data.channels;
    }
    return this.request(API_CONFIG.ENDPOINTS.NOTIFICATIONS.UPDATE(id), {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteNotification(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.NOTIFICATIONS.DELETE(id), {
      method: 'DELETE',
    });
  }

  async sendNotification(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.NOTIFICATIONS.SEND(id), {
      method: 'POST',
    });
  }

  async getUnreadNotifications(): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.NOTIFICATIONS.UNREAD);
  }

  async markNotificationAsRead(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.NOTIFICATIONS.MARK_READ(id), {
      method: 'POST',
    });
  }

  async decodeToken(token: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.PAYMENTS.DECODE_TOKEN, {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  // Notification Preferences methods
  async getNotificationPreferences(): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.NOTIFICATION_PREFERENCES.LIST);
  }

  async getAvailableChannels(): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.NOTIFICATION_PREFERENCES.AVAILABLE_CHANNELS);
  }

  async bulkUpdateNotificationPreferences(preferences: Record<string, any>): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.NOTIFICATION_PREFERENCES.BULK_UPDATE, {
      method: 'POST',
      body: JSON.stringify(preferences),
    });
  }

  async getNotificationPreference(type: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.NOTIFICATION_PREFERENCES.SHOW(type));
  }

  async updateNotificationPreference(type: string, preferenceData: any): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.NOTIFICATION_PREFERENCES.UPDATE(type), {
      method: 'PUT',
      body: JSON.stringify(preferenceData),
    });
  }

  // Users Management methods
  async getUsers(filters?: { per_page?: number; page?: number; role?: string; status?: string; search?: string }): Promise<ApiResponse> {
    const params = new URLSearchParams();
    if (filters?.per_page) params.append('per_page', filters.per_page.toString());
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.role) params.append('role', filters.role);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);

    const queryString = params.toString();
    const endpoint = queryString ? `${API_CONFIG.ENDPOINTS.USERS.LIST}?${queryString}` : API_CONFIG.ENDPOINTS.USERS.LIST;
    return this.request(endpoint);
  }

  async getUser(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.USERS.SHOW(id));
  }

  async createUser(userData: {
    name: string;
    email: string;
    password: string;
    password_confirmation?: string;
    phone?: string;
    address?: string;
    bio?: string;
    role: 'tutor' | 'student' | 'parent' | 'admin' | 'super_admin';
    status?: 'active' | 'inactive';
  }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.USERS.CREATE, {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async updateUser(id: string, userData: {
    name?: string;
    email?: string;
    phone?: string;
    role?: 'tutor' | 'student' | 'parent' | 'admin' | 'super_admin';
    status?: 'active' | 'inactive';
  }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.USERS.UPDATE(id), {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.USERS.DELETE(id), {
      method: 'DELETE',
    });
  }

  async resetUserPassword(id: string, data: {
    password: string;
    password_confirmation: string;
  }): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.USERS.RESET_PASSWORD(id), {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async activateUser(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.USERS.ACTIVATE(id), {
      method: 'POST',
    });
  }

  async deactivateUser(id: string): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.USERS.DEACTIVATE(id), {
      method: 'POST',
    });
  }

  // Reports methods
  async getReportOverview(filters?: ReportOverviewFilters): Promise<ApiResponse> {
    const endpoint = this.buildEndpointWithQuery(
      API_CONFIG.ENDPOINTS.REPORTS.OVERVIEW,
      filters
    );
    return this.request(endpoint);
  }

  async getRevenueReport(filters?: RevenueReportFilters): Promise<ApiResponse> {
    const endpoint = this.buildEndpointWithQuery(
      API_CONFIG.ENDPOINTS.REPORTS.REVENUE,
      filters,
      { excludeValues: ['all'] }
    );
    return this.request(endpoint);
  }

  async getReportStatistics(filters?: ReportStatisticsFilters): Promise<ApiResponse> {
    const endpoint = this.buildEndpointWithQuery(
      API_CONFIG.ENDPOINTS.REPORTS.STATISTICS,
      filters
    );
    return this.request(endpoint);
  }

  async getPaymentsReport(filters?: PaymentsReportFilters): Promise<ApiResponse> {
    const endpoint = this.buildEndpointWithQuery(
      API_CONFIG.ENDPOINTS.REPORTS.PAYMENTS,
      filters,
      { excludeValues: ['all'] }
    );
    return this.request(endpoint);
  }

  async getAttendanceReport(filters?: AttendanceReportFilters): Promise<ApiResponse> {
    const endpoint = this.buildEndpointWithQuery(
      API_CONFIG.ENDPOINTS.REPORTS.ATTENDANCE,
      filters,
      { excludeValues: ['all'] }
    );
    return this.request(endpoint);
  }

  async getStudentsReport(filters?: StudentsReportFilters): Promise<ApiResponse> {
    const endpoint = this.buildEndpointWithQuery(
      API_CONFIG.ENDPOINTS.REPORTS.STUDENTS,
      filters,
      { excludeValues: ['all'] }
    );
    return this.request(endpoint);
  }

  async getClassesReport(filters?: ClassesReportFilters): Promise<ApiResponse> {
    const endpoint = this.buildEndpointWithQuery(
      API_CONFIG.ENDPOINTS.REPORTS.CLASSES,
      filters,
      { excludeValues: ['all'] }
    );
    return this.request(endpoint);
  }

  async getAssignmentsReport(filters?: AssignmentsReportFilters): Promise<ApiResponse> {
    const endpoint = this.buildEndpointWithQuery(
      API_CONFIG.ENDPOINTS.REPORTS.ASSIGNMENTS,
      filters,
      { excludeValues: ['all'] }
    );
    return this.request(endpoint);
  }

  /**
   * Export report as file (Excel, CSV)
   * @param reportType - Type of report (overview, revenue, payments, etc.)
   * @param format - Export format (excel, csv)
   * @param filters - Report filters
   * @returns Promise<{ blob: Blob, actualFormat: 'excel' | 'csv' }> - File blob and actual format (may differ if backend fallback to CSV)
   */
  async exportReport(
    reportType: 'overview' | 'revenue' | 'payments' | 'attendance' | 'students' | 'classes' | 'assignments' | 'addons',
    format: 'excel' | 'csv',
    filters?: Record<string, any>
  ): Promise<{ blob: Blob; actualFormat: 'excel' | 'csv' }> {
    // Map report type to endpoint
    const endpointMap: Record<string, string> = {
      overview: API_CONFIG.ENDPOINTS.REPORTS.EXPORT_OVERVIEW,
      revenue: API_CONFIG.ENDPOINTS.REPORTS.EXPORT_REVENUE,
      payments: API_CONFIG.ENDPOINTS.REPORTS.EXPORT_PAYMENTS,
      attendance: API_CONFIG.ENDPOINTS.REPORTS.EXPORT_ATTENDANCE,
      students: API_CONFIG.ENDPOINTS.REPORTS.EXPORT_STUDENTS,
      classes: API_CONFIG.ENDPOINTS.REPORTS.EXPORT_CLASSES,
      assignments: API_CONFIG.ENDPOINTS.REPORTS.EXPORT_ASSIGNMENTS,
    };

    const baseEndpoint = endpointMap[reportType];
    if (!baseEndpoint) {
      throw new Error(`Invalid report type: ${reportType}`);
    }

    // Build query string with format and filters
    const queryParams = {
      format,
      ...filters,
    };
    const endpoint = this.buildEndpointWithQuery(baseEndpoint, queryParams, { excludeValues: ['all'] });
    const url = `${this.baseURL}${endpoint}`;

    // Fetch file with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds timeout for file download

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': '*/*',
          // Always send Authorization header if token exists (even for /api/* routes as fallback)
          ...this.getAuthHeader(),
        },
        // Include cookies (HttpOnly cookies) automatically
        credentials: 'include',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Try to parse error response
        try {
          const errorData = await response.json();
          throw new Error(errorData.message || `Export failed: ${response.status} ${response.statusText}`);
        } catch {
          throw new Error(`Export failed: ${response.status} ${response.statusText}`);
        }
      }

      // Check if response is actually a file (blob)
      const contentType = response.headers.get('content-type') || '';
      let actualFormat: 'excel' | 'csv' = 'csv'; // Default to CSV

      if (contentType.includes('application/vnd.openxmlformats') || contentType.includes('application/vnd.ms-excel')) {
        actualFormat = 'excel';
      } else if (contentType.includes('text/csv')) {
        actualFormat = 'csv';
      } else if (contentType.includes('application/octet-stream')) {
        // Try to detect from content-disposition header or default to requested format
        const contentDisposition = response.headers.get('content-disposition') || '';
        if (contentDisposition.includes('.xlsx') || contentDisposition.includes('.xls')) {
          actualFormat = 'excel';
        } else {
          // Fallback to requested format if can't detect
          actualFormat = format;
        }
      }

      if (contentType && (
        contentType.includes('application/vnd.openxmlformats') ||
        contentType.includes('application/vnd.ms-excel') ||
        contentType.includes('text/csv') ||
        contentType.includes('application/octet-stream')
      )) {
        const blob = await response.blob();
        return { blob, actualFormat };
      }

      // If not a blob, might be JSON error
      const data = await response.json();
      throw new Error(data.message || 'Export failed: Invalid response format');
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Export request timeout. Please try again.');
      }
      throw error;
    }
  }

  /**
   * Import data from file (CSV/Excel)
   * @param type - Type of import (students, enrollments, attendance, grades, payments, assignment-types, subjects, grade-levels, grade-types)
   * @param file - File to import
   * @param options - Import options (skip_duplicates, override_existing, etc.)
   * @returns Promise<ApiResponse> - Import result with success/failed/skipped counts
   */
  async importData(
    type:
      | 'students'
      | 'enrollments'
      | 'attendance'
      | 'grades'
      | 'payments'
      | 'assignment-types'
      | 'subjects'
      | 'grade-levels'
      | 'grade-types',
    file: File,
    options?: {
      skip_duplicates?: boolean;
      override_existing?: boolean;
    }
  ): Promise<ApiResponse> {
    const endpointMap: Record<string, string> = {
      students: API_CONFIG.ENDPOINTS.IMPORT_EXPORT.IMPORT_STUDENTS,
      enrollments: API_CONFIG.ENDPOINTS.IMPORT_EXPORT.IMPORT_ENROLLMENTS,
      attendance: API_CONFIG.ENDPOINTS.IMPORT_EXPORT.IMPORT_ATTENDANCE,
      grades: API_CONFIG.ENDPOINTS.IMPORT_EXPORT.IMPORT_GRADES,
      payments: API_CONFIG.ENDPOINTS.IMPORT_EXPORT.IMPORT_PAYMENTS,
      'assignment-types': API_CONFIG.ENDPOINTS.IMPORT_EXPORT.IMPORT_ASSIGNMENT_TYPES,
      subjects: API_CONFIG.ENDPOINTS.IMPORT_EXPORT.IMPORT_SUBJECTS,
      'grade-levels': API_CONFIG.ENDPOINTS.IMPORT_EXPORT.IMPORT_GRADE_LEVELS,
      'grade-types': API_CONFIG.ENDPOINTS.IMPORT_EXPORT.IMPORT_GRADE_TYPES,
    };

    const endpoint = endpointMap[type];
    if (!endpoint) {
      throw new Error(`Invalid import type: ${type}`);
    }

    const formData = new FormData();
    formData.append('file', file);

    if (options?.skip_duplicates !== undefined) {
      formData.append('skip_duplicates', String(options.skip_duplicates));
    }
    if (options?.override_existing !== undefined) {
      formData.append('override_existing', String(options.override_existing));
    }

    return this.request(endpoint, {
      method: 'POST',
      body: formData,
    });
  }

  /**
   * Export data to file (CSV/Excel)
   * @param type - Type of export (students, attendance, grades, payments, overview, revenue, etc.)
   * @param format - Export format (excel, csv)
   * @param filters - Export filters
   * @returns Promise<{ blob: Blob, actualFormat: 'excel' | 'csv' }> - File blob and actual format
   */
  async exportData(
    type:
      | 'students'
      | 'attendance'
      | 'grades'
      | 'payments'
      | 'overview'
      | 'revenue'
      | 'payment-requests'
      | 'classes'
      | 'assignments'
      | 'login-activities'
      | 'assignment-types'
      | 'subjects'
      | 'grade-levels'
      | 'grade-types',
    format: 'excel' | 'csv',
    filters?: Record<string, any>
  ): Promise<{ blob: Blob; actualFormat: 'excel' | 'csv' }> {
    const endpointMap: Record<string, string> = {
      students: API_CONFIG.ENDPOINTS.IMPORT_EXPORT.EXPORT_STUDENTS,
      attendance: API_CONFIG.ENDPOINTS.IMPORT_EXPORT.EXPORT_ATTENDANCE,
      grades: API_CONFIG.ENDPOINTS.IMPORT_EXPORT.EXPORT_GRADES,
      payments: API_CONFIG.ENDPOINTS.IMPORT_EXPORT.EXPORT_PAYMENTS,
      overview: API_CONFIG.ENDPOINTS.IMPORT_EXPORT.EXPORT_OVERVIEW,
      revenue: API_CONFIG.ENDPOINTS.IMPORT_EXPORT.EXPORT_REVENUE,
      'payment-requests': API_CONFIG.ENDPOINTS.IMPORT_EXPORT.EXPORT_PAYMENT_REQUESTS,
      classes: API_CONFIG.ENDPOINTS.IMPORT_EXPORT.EXPORT_CLASSES,
      assignments: API_CONFIG.ENDPOINTS.IMPORT_EXPORT.EXPORT_ASSIGNMENTS,
      'login-activities': API_CONFIG.ENDPOINTS.IMPORT_EXPORT.EXPORT_LOGIN_ACTIVITIES,
      'assignment-types': API_CONFIG.ENDPOINTS.IMPORT_EXPORT.EXPORT_ASSIGNMENT_TYPES,
      subjects: API_CONFIG.ENDPOINTS.IMPORT_EXPORT.EXPORT_SUBJECTS,
      'grade-levels': API_CONFIG.ENDPOINTS.IMPORT_EXPORT.EXPORT_GRADE_LEVELS,
      'grade-types': API_CONFIG.ENDPOINTS.IMPORT_EXPORT.EXPORT_GRADE_TYPES,
    };

    const baseEndpoint = endpointMap[type];
    if (!baseEndpoint) {
      throw new Error(`Invalid export type: ${type}`);
    }

    // Build query string with format and filters
    const queryParams = {
      format,
      ...filters,
    };
    const endpoint = this.buildEndpointWithQuery(baseEndpoint, queryParams, { excludeValues: ['all'] });
    const url = `${this.baseURL}${endpoint}`;

    // Fetch file with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds timeout for file download

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': '*/*',
          // Always send Authorization header if token exists (even for /api/* routes as fallback)
          ...this.getAuthHeader(),
        },
        // Include cookies (HttpOnly cookies) automatically
        credentials: 'include',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Try to parse error response
        try {
          const errorData = await response.json();
          throw new Error(errorData.message || `Export failed: ${response.status} ${response.statusText}`);
        } catch {
          throw new Error(`Export failed: ${response.status} ${response.statusText}`);
        }
      }

      // Check if response is actually a file (blob)
      const contentType = response.headers.get('content-type') || '';
      let actualFormat: 'excel' | 'csv' = 'csv'; // Default to CSV

      if (contentType.includes('application/vnd.openxmlformats') || contentType.includes('application/vnd.ms-excel')) {
        actualFormat = 'excel';
      } else if (contentType.includes('text/csv')) {
        actualFormat = 'csv';
      } else if (contentType.includes('application/octet-stream')) {
        // Try to detect from content-disposition header or default to requested format
        const contentDisposition = response.headers.get('content-disposition') || '';
        if (contentDisposition.includes('.xlsx') || contentDisposition.includes('.xls')) {
          actualFormat = 'excel';
        } else {
          // Fallback to requested format if can't detect
          actualFormat = format;
        }
      }

      if (contentType && (
        contentType.includes('application/vnd.openxmlformats') ||
        contentType.includes('application/vnd.ms-excel') ||
        contentType.includes('text/csv') ||
        contentType.includes('application/octet-stream')
      )) {
        const blob = await response.blob();
        return { blob, actualFormat };
      }

      // If not a blob, might be JSON error
      const data = await response.json();
      throw new Error(data.message || 'Export failed: Invalid response format');
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Export request timeout. Please try again.');
      }
      throw error;
    }
  }

  /**
   * Export system settings
   * @param groups - Settings groups to export (optional)
   * @returns Promise<ApiResponse> - Settings data
   */
  async exportSettings(groups?: string[]): Promise<ApiResponse> {
    const queryParams = groups && groups.length > 0 ? { groups: groups.join(',') } : {};
    const endpoint = this.buildEndpointWithQuery(
      API_CONFIG.ENDPOINTS.IMPORT_EXPORT.EXPORT_SETTINGS,
      queryParams
    );
    return this.request(endpoint);
  }

  /**
   * Import system settings
   * @param settings - Settings array to import
   * @param options - Import options (dry_run, overwrite)
   * @returns Promise<ApiResponse> - Import result
   */
  async importSettings(
    settings: any[],
    options?: {
      dry_run?: boolean;
      overwrite?: boolean;
    }
  ): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.IMPORT_EXPORT.IMPORT_SETTINGS, {
      method: 'POST',
      body: JSON.stringify({
        settings,
        dry_run: options?.dry_run ?? false,
        overwrite: options?.overwrite ?? false,
      }),
    });
  }

  /**
   * Export email templates
   * @param format - Export format (json, csv)
   * @returns Promise<ApiResponse> - Templates data
   */
  async exportEmailTemplates(format: 'json' | 'csv' = 'json'): Promise<ApiResponse> {
    const endpoint = this.buildEndpointWithQuery(
      API_CONFIG.ENDPOINTS.IMPORT_EXPORT.EXPORT_EMAIL_TEMPLATES,
      { format }
    );
    return this.request(endpoint);
  }

  /**
   * Import email templates
   * @param templates - Templates array to import
   * @param overwrite - Overwrite existing templates
   * @returns Promise<ApiResponse> - Import result
   */
  async importEmailTemplates(templates: any[], overwrite: boolean = false): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.IMPORT_EXPORT.IMPORT_EMAIL_TEMPLATES, {
      method: 'POST',
      body: JSON.stringify({
        templates,
        overwrite,
      }),
    });
  }

  // Token management
  // Tokens live in HttpOnly cookies managed by the BFF. These setters only keep
  // an optional in-memory copy for the current session; they never persist to
  // localStorage (S2).
  setToken(token: string): void {
    this.token = token;
  }

  setRefreshToken(refreshToken: string): void {
    this.refreshTokenValue = refreshToken;
  }

  clearToken(): void {
    this.token = null;
    this.refreshTokenValue = null;
    this.refreshPromise = null; // Clear refresh promise khi clear token
    // Cookies are cleared by the logout API route; nothing to clear in localStorage.
  }

  getToken(): string | null {
    return this.token;
  }

  getRefreshToken(): string | null {
    return this.refreshTokenValue;
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  /**
   * Get data jobs (import/export history)
   * @param filters - Filter options (module, type, status, date_from, date_to, per_page, page)
   * @returns Promise<ApiResponse> - List of data jobs with pagination
   */
  async getDataJobs(filters?: {
    module?: string;
    type?: 'import' | 'export';
    status?: 'processing' | 'success' | 'partial' | 'failed';
    date_from?: string;
    date_to?: string;
    per_page?: number;
    page?: number;
  }): Promise<ApiResponse> {
    const endpoint = this.buildEndpointWithQuery(
      API_CONFIG.ENDPOINTS.DATA_JOBS.LIST,
      filters,
      { excludeValues: ['all', ''] }
    );
    return this.request(endpoint);
  }

  /**
   * Get data job detail
   * @param id - Job ID
   * @returns Promise<ApiResponse> - Job detail
   */
  async getDataJob(id: string | number): Promise<ApiResponse> {
    return this.request(API_CONFIG.ENDPOINTS.DATA_JOBS.SHOW(String(id)));
  }
}

// Create and export a singleton instance
export const apiClient = new ApiClient();
export default apiClient;
