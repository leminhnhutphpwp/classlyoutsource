'use client';

import { useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/lib/api-config';
import type {
  CurrentOrganization,
  OrgDashboard,
  OrgMember,
  OrgMemberStatus,
  OrgRole,
} from '@/types/organization';
import { useApi, useMutation } from './core';

// Hình dạng FLAT thô từ backend (khoá `_id`), chỉ khai báo các trường FE dùng.
interface RawOrgMember {
  _id: string;
  name: string;
  email: string;
  org_role: OrgRole;
  status: OrgMemberStatus;
  activated?: boolean;
}
interface RawOrg {
  _id: string;
  name: string;
  description?: string | null;
  status?: string;
  created_at?: string;
  updated_at?: string;
  my_role: OrgRole;
  members?: RawOrgMember[];
}

/** Chuẩn hoá 1 thành viên FLAT (`_id`) → nội bộ (`id`); `activated` mặc định false. */
function normalizeMember(m: RawOrgMember): OrgMember {
  return {
    id: m._id,
    name: m.name,
    email: m.email,
    org_role: m.org_role,
    status: m.status,
    activated: m.activated ?? false,
  };
}

/**
 * Chuẩn hoá FLAT OrganizationResource (khoá `_id`) từ backend về hình dạng nội bộ
 * `CurrentOrganization` (khoá `id`). Backend trả members ACTIVE ở top-level.
 */
function normalizeCurrentOrg(raw: RawOrg | null | undefined): CurrentOrganization | null {
  if (!raw || !raw._id) return null;
  const members: OrgMember[] = Array.isArray(raw.members)
    ? raw.members.map(normalizeMember)
    : [];
  return {
    organization: {
      id: raw._id,
      name: raw.name,
      description: raw.description ?? null,
      status: raw.status,
      created_at: raw.created_at,
      updated_at: raw.updated_at,
    },
    members,
    my_role: raw.my_role,
  };
}

/** Payload tạo gia sư cho trung tâm. `org_role` mặc định `tutor` phía backend. */
export interface CreateOrgMemberPayload {
  name: string;
  email: string;
  phone?: string;
  org_role?: Extract<OrgRole, 'tutor' | 'manager' | 'accountant'>;
}

/**
 * Tính năng Trung tâm (Organization) gọi backend qua BFF cùng-origin.
 *
 * Client baseURL rỗng → mọi endpoint bắt đầu bằng `/api/...` sẽ tới Next route
 * handler. Route catch-all `src/app/api/[...path]/route.ts` forward
 * `/api/organizations/*` → Laravel `/api/v1/organizations/*`. Không cần thêm
 * route handler riêng.
 */

const CURRENT_ORG_CACHE_KEY = 'organizations:current';
const ORG_CACHE_TTL = 2 * 60 * 1000; // 2 phút

// ---- Reads -----------------------------------------------------------------

/**
 * GET /organizations/current → { organization, members, my_role } hoặc data:null.
 * Chỉ nên bật cho giáo viên (students/parents không thuộc trung tâm).
 */
export function useCurrentOrganization(enabled: boolean = true) {
  const memoizedApiCall = useCallback(async (): Promise<
    ApiResponse<CurrentOrganization | null>
  > => {
    const res = await apiClient.makeRequest<RawOrg | null>('/api/organizations/current');
    return { ...res, data: res.success ? normalizeCurrentOrg(res.data) : null };
  }, []);

  return useApi<CurrentOrganization | null>(
    memoizedApiCall,
    [],
    true,
    enabled,
    {
      cacheKey: CURRENT_ORG_CACHE_KEY,
      ttl: ORG_CACHE_TTL,
      strategy: 'stale-while-revalidate',
    }
  );
}

/** GET /organizations/{orgHash}/dashboard → tổng hợp + breakdown theo GV. */
export function useOrganizationDashboard(orgHash?: string, enabled: boolean = true) {
  const memoizedApiCall = useCallback(
    () => apiClient.makeRequest<OrgDashboard>(`/api/organizations/${orgHash}/dashboard`),
    [orgHash]
  );

  return useApi<OrgDashboard>(
    memoizedApiCall,
    [orgHash],
    true,
    enabled && !!orgHash,
    {
      cacheKey: `organizations:dashboard:${orgHash || 'none'}`,
      ttl: ORG_CACHE_TTL,
      strategy: 'stale-while-revalidate',
    }
  );
}

// ---- Mutations -------------------------------------------------------------

/** POST /organizations → tạo trung tâm. */
export function useCreateOrganization() {
  return useMutation(
    (payload: { name: string; description?: string }): Promise<ApiResponse<CurrentOrganization>> =>
      apiClient.makeRequest('/api/organizations', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    { invalidateCachePrefixes: ['organizations:'] }
  );
}

/** PATCH /organizations/{orgHash} → cập nhật tên/mô tả (owner/manager). */
export function useUpdateOrganization() {
  return useMutation(
    (orgHash: string, payload: { name?: string; description?: string }): Promise<ApiResponse> =>
      apiClient.makeRequest(`/api/organizations/${orgHash}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    { invalidateCachePrefixes: ['organizations:'] }
  );
}

/**
 * POST /organizations/{orgHash}/members → TẠO một gia sư mới cho trung tâm.
 * Backend trả 201 + OrganizationMemberResource (`_id`), được chuẩn hoá về `id`.
 * Lỗi trùng email → 422 `code: EMAIL_ALREADY_EXISTS`.
 */
export function useCreateOrgMember() {
  return useMutation(
    async (
      orgHash: string,
      payload: CreateOrgMemberPayload
    ): Promise<ApiResponse<OrgMember | null>> => {
      const res = await apiClient.makeRequest<RawOrgMember>(
        `/api/organizations/${orgHash}/members`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
      return {
        ...res,
        data: res.success && res.data ? normalizeMember(res.data) : null,
      };
    },
    { invalidateCachePrefixes: ['organizations:'] }
  );
}

/**
 * DELETE /organizations/{orgHash}/members/{memberHash} → gỡ thành viên,
 * thu hồi phiên đăng nhập và tạm ngưng account cho đến khi được khôi phục.
 */
export function useRemoveOrgMember() {
  return useMutation(
    (orgHash: string, memberHash: string): Promise<ApiResponse> =>
      apiClient.makeRequest(`/api/organizations/${orgHash}/members/${memberHash}`, {
        method: 'DELETE',
      }),
    { invalidateCachePrefixes: ['organizations:'] }
  );
}

/**
 * PATCH /organizations/{orgHash}/members/{memberHash} → đổi vai trò (chỉ owner).
 * Body `{ org_role }` (tutor | manager | accountant).
 */
export function useUpdateOrgMemberRole() {
  return useMutation(
    (
      orgHash: string,
      memberHash: string,
      orgRole: Extract<OrgRole, 'tutor' | 'manager' | 'accountant'>
    ): Promise<ApiResponse> =>
      apiClient.makeRequest(`/api/organizations/${orgHash}/members/${memberHash}`, {
        method: 'PATCH',
        body: JSON.stringify({ org_role: orgRole }),
      }),
    { invalidateCachePrefixes: ['organizations:'] }
  );
}

/** POST /organizations/{orgHash}/members/{memberHash}/restore → khôi phục thành viên đã gỡ. */
export function useRestoreOrgMember() {
  return useMutation(
    (orgHash: string, memberHash: string): Promise<ApiResponse> =>
      apiClient.makeRequest(
        `/api/organizations/${orgHash}/members/${memberHash}/restore`,
        { method: 'POST' }
      ),
    { invalidateCachePrefixes: ['organizations:'] }
  );
}

/** POST /organizations/{orgHash}/classes/{classHash}/assign → đổi GV phụ trách lớp. */
export function useAssignClassTutor() {
  return useMutation(
    (orgHash: string, classHash: string, tutorId: string): Promise<ApiResponse> =>
      apiClient.makeRequest(`/api/organizations/${orgHash}/classes/${classHash}/assign`, {
        method: 'POST',
        body: JSON.stringify({ tutor_id: tutorId }),
      }),
    { invalidateCachePrefixes: ['organizations:', 'classes:'] }
  );
}
