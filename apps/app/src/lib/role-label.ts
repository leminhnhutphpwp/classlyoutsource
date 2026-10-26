/**
 * Nhãn vai trò hiển thị — MỘT nguồn duy nhất cho toàn app.
 *
 * Vì sao cần file này: theo thiết kế tổ chức, mọi thành viên trung tâm đều có
 * `users.role = 'tutor'` — kể cả chủ trung tâm, quản lý học vụ và kế toán. Vai trò thật nằm ở
 * `organization_members.org_role`. Trước đây mỗi màn hình tự map từ `user.role`, nên giám đốc
 * bị gắn nhãn "Giáo viên" ở header, trang hồ sơ và danh sách người dùng.
 *
 * Backend đã tính sẵn `role_label` trong `/auth/me` (AuthController::me) và `UserResource`.
 * Các hàm dưới đây ưu tiên dùng nhãn đó, chỉ tự suy khi API cũ chưa trả về.
 *
 * LƯU Ý: đây là nhãn HIỂN THỊ. Đừng dùng để phân quyền — quyền phải dựa trên
 * `role`, `org_role`, capability hoặc permission.
 */

export type OrgRole = 'owner' | 'manager' | 'accountant' | 'tutor';

/** Khớp với ORG_ROLE_LABELS ở app/organization/_components/org-ui.tsx và backend. */
export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Chủ trung tâm',
  manager: 'Quản lý',
  accountant: 'Kế toán',
  tutor: 'Giáo viên',
};

const BASE_ROLE_LABELS: Record<string, string> = {
  super_admin: 'Quản trị hệ thống',
  admin: 'Quản trị viên',
  student: 'Học viên',
  parent: 'Phụ huynh',
};

type UserLike = {
  role?: string | null;
  org_role?: string | null;
  role_label?: string | null;
} | null | undefined;

/**
 * Nhãn vai trò của một người dùng.
 * Thứ tự ưu tiên: `role_label` từ API → suy từ `org_role` → suy từ `role` → 'Thành viên'.
 */
export function roleLabel(user: UserLike): string {
  if (!user) return 'Thành viên';
  if (user.role_label) return user.role_label;

  if (user.role && BASE_ROLE_LABELS[user.role]) {
    return BASE_ROLE_LABELS[user.role];
  }

  if (user.org_role && ORG_ROLE_LABELS[user.org_role as OrgRole]) {
    return ORG_ROLE_LABELS[user.org_role as OrgRole];
  }

  return user.role === 'tutor' ? 'Giáo viên' : 'Thành viên';
}

/** Khoá màu badge — tách khỏi nhãn để mỗi nơi tự chọn bảng màu của mình. */
export function roleColorKey(user: UserLike): string {
  if (!user) return 'default';
  if (user.role === 'super_admin' || user.role === 'admin') return 'admin';
  if (user.role === 'student' || user.role === 'parent') return user.role;
  return user.org_role ?? 'tutor';
}
