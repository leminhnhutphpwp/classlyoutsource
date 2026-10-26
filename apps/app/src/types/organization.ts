// Types cho tính năng Trung tâm (Organization / multi-tutor center).
// Backend trả về id dạng hashid, envelope { success, message, data }.
//
// LƯU Ý HÌNH DẠNG: backend trả FLAT OrganizationResource với khoá `_id`
// (org._id, member._id, organization._id). Các type dưới đây là hình dạng NỘI BỘ
// đã chuẩn hoá (`id`). Việc map `_id` → `id` được thực hiện MỘT LẦN trong
// `useCurrentOrganization` / `useCreateOrgMember` (hooks/use-api/organizations.ts),
// nhờ đó mọi consumer chỉ đọc `.id` là đủ.

export type OrgRole = 'owner' | 'manager' | 'accountant' | 'tutor';
export type OrgMemberStatus = 'active' | 'invited' | 'removed';

export interface OrgMember {
  id: string; // đã chuẩn hoá từ member._id
  name: string;
  email: string;
  org_role: OrgRole;
  status: OrgMemberStatus;
  /**
   * `false` = gia sư đã được trung tâm tạo nhưng chưa đặt mật khẩu / xác thực
   * email (chưa thể đăng nhập). `true` = đã kích hoạt, đăng nhập được.
   */
  activated: boolean;
}

export interface Organization {
  id: string; // đã chuẩn hoá từ org._id
  name: string;
  description?: string | null;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Hình dạng NỘI BỘ đã chuẩn hoá của GET /organizations/current.
 * Backend thực tế trả FLAT: { _id, name, description, my_role, members[], ... }
 * hoặc `data:null` khi caller chưa thuộc trung tâm ACTIVE nào. Hook chuẩn hoá về
 * cấu trúc gọn này để consumer dùng.
 */
export interface CurrentOrganization {
  organization: Organization;
  members: OrgMember[];
  my_role: OrgRole;
}

/**
 * Thống kê của 1 giáo viên trong trung tâm (per-tutor breakdown).
 * Khớp DashboardController::orgOwnerDashboard → `tutor_breakdown[]`.
 */
export interface OrgTutorBreakdown {
  tutor_id?: string; // hashid
  tutor_name?: string;
  org_role?: OrgRole;
  total_classes?: number;
  total_students?: number;
  attendance_this_month?: number;
  revenue_this_month?: number;
  [key: string]: unknown;
}

/**
 * Payload của GET /organizations/{orgHash}/dashboard.
 * Khớp envelope backend: `statistics` = tổng hợp toàn trung tâm,
 * `tutor_breakdown` = breakdown theo từng GV.
 */
export interface OrgDashboard {
  statistics?: {
    total_classes?: number;
    active_classes?: number;
    total_students?: number;
    attendance_this_month?: number;
    revenue_this_month?: number;
    assignments_this_month?: number;
    [key: string]: unknown;
  };
  tutor_breakdown?: OrgTutorBreakdown[];
  organization?: { _id?: string; name?: string };
  org_role?: OrgRole;
  [key: string]: unknown;
}
