"use client";

import type { ApiResponse } from './api-config';

/**
 * Request Deduplication Manager
 * Tránh duplicate API calls bằng cách track các requests đang chạy
 * Nếu cùng một request đang chạy, đợi request hiện tại thay vì gọi mới
 */
// Chỉ deduplicate các method idempotent. Với POST/PUT/PATCH/DELETE (các thao
// tác ghi, không idempotent), việc gộp hai request giống hệt nhau trong cùng
// một tick sẽ âm thầm bỏ mất lần ghi thứ hai (P2-D). Các method này luôn được
// thực thi riêng biệt.
const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD']);

class RequestDeduplicationManager {
  private pendingRequests = new Map<string, Promise<ApiResponse<any>>>();

  /**
   * Kiểm tra xem method có được phép deduplicate không.
   */
  private isDeduplicable(options?: RequestInit): boolean {
    const method = (options?.method || 'GET').toUpperCase();
    return IDEMPOTENT_METHODS.has(method);
  }

  /**
   * Tạo request key từ endpoint và options
   * @param endpoint API endpoint
   * @param options Request options (method, body, etc.)
   * @returns Unique request key
   */
  private createRequestKey(endpoint: string, options?: RequestInit): string {
    const method = (options?.method || 'GET').toUpperCase();
    const body = options?.body;

    // Tạo key từ endpoint và method
    let key = `${method}:${endpoint}`;

    // Nếu có body, hash body để tạo unique key
    if (body) {
      if (body instanceof FormData) {
        // FormData: dùng endpoint + method làm key (FormData khó hash)
        // Có thể cải thiện bằng cách sort FormData entries
        key = `${method}:${endpoint}:form-data`;
      } else if (typeof body === 'string') {
        // JSON string: hash body
        try {
          const bodyObj = JSON.parse(body);
          const sortedBody = JSON.stringify(bodyObj, Object.keys(bodyObj).sort());
          key = `${method}:${endpoint}:${this.hashString(sortedBody)}`;
        } catch {
          // Nếu không parse được, dùng body string trực tiếp
          key = `${method}:${endpoint}:${this.hashString(body)}`;
        }
      } else {
        key = `${method}:${endpoint}:${this.hashString(String(body))}`;
      }
    }

    return key;
  }

  /**
   * Hash string để tạo unique key
   * @param str String cần hash
   * @returns Hash string
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Thực hiện request với deduplication
   * Nếu cùng một request đang chạy, đợi request hiện tại
   * @param endpoint API endpoint
   * @param requestFn Function để thực hiện request
   * @param options Request options
   * @returns Promise với response
   */
  async request<T>(
    endpoint: string,
    requestFn: () => Promise<ApiResponse<T>>,
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
    // Không idempotent (POST/PUT/PATCH/DELETE) → luôn thực thi, không dedup.
    // Nếu không, hai lần ghi giống nhau cùng tick sẽ bị gộp và mất một lần.
    if (!this.isDeduplicable(options)) {
      return requestFn();
    }

    const requestKey = this.createRequestKey(endpoint, options);

    // Kiểm tra xem có request đang chạy không
    const pendingRequest = this.pendingRequests.get(requestKey);
    if (pendingRequest) {
      // Đã có request đang chạy, đợi request đó
      return pendingRequest as Promise<ApiResponse<T>>;
    }

    // Tạo request mới
    const requestPromise = requestFn()
      .then((response) => {
        // Request hoàn thành, xóa khỏi pending
        this.pendingRequests.delete(requestKey);
        return response;
      })
      .catch((error) => {
        // Request lỗi, xóa khỏi pending
        this.pendingRequests.delete(requestKey);
        throw error;
      });

    // Lưu request vào pending
    this.pendingRequests.set(requestKey, requestPromise);

    return requestPromise;
  }

  /**
   * Xóa request khỏi pending (khi cần cancel)
   * @param endpoint API endpoint
   * @param options Request options
   */
  clearRequest(endpoint: string, options?: RequestInit): void {
    const requestKey = this.createRequestKey(endpoint, options);
    this.pendingRequests.delete(requestKey);
  }

  /**
   * Xóa tất cả pending requests
   */
  clearAll(): void {
    this.pendingRequests.clear();
  }

  /**
   * Lấy số lượng requests đang pending
   */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Lấy danh sách các request keys đang pending
   */
  getPendingKeys(): string[] {
    return Array.from(this.pendingRequests.keys());
  }
}

// Export singleton instance
export const requestDeduplicationManager = new RequestDeduplicationManager();

