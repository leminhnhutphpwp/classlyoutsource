import { useAuthorization } from "@/lib/authz";
import { PARENT_NAV_DATA } from "@/components/Layouts/sidebar/data/parent-nav";
import { useOrganizationContext } from "@/contexts/organization-context";
import { canImportData, canExportData } from "@/lib/import-export-permissions";

export type MenuItem = {
  title: string;
  url?: string;
  icon?: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  items?: MenuItem[];
};

export type MenuSection = {
  label: string;
  items: MenuItem[];
};

/**
 * Check if a menu item should be visible based on role and permissions
 * 
 * Note về permissions của học viên:
 * - Backend đã xử lý logic filter permissions của học viên dựa trên permissions của giáo viên
 *   trong /api/v1/auth/me. Vì vậy, nếu học viên có permission trong user.permissions
 *   thì có nghĩa là giáo viên của họ cũng có permission đó.
 * - Frontend chỉ cần check user.permissions là đủ, không cần check permissions của giáo viên riêng.
 * - Nếu cần check permissions của giáo viên cụ thể (trong context của một lớp),
 *   sử dụng canWithTutor() từ useAuthorization().
 */
export function useMenuPermissions() {
  const { can, hasRole, user } = useAuthorization();
  const {
    canSeeOrgNav,
    canViewFinance,
    canManagePayroll,
    canManageOrg,
    isMemberTutor,
  } = useOrganizationContext();
  const isStudent = hasRole('student');
  const isParent = user?.role === 'parent';

  /**
   * Check if a menu item should be visible
   * 
   * Đối với học viên: Permissions đã được backend filter dựa trên permissions của giáo viên.
   * Nếu học viên có permission thì giáo viên của họ cũng có permission đó.
   */
  const shouldShowMenuItem = (item: MenuItem, sectionLabel?: string): boolean => {
    // Trung tâm (Organization): chỉ hiện cho giáo viên đã thuộc một trung tâm
    // (kể cả lời mời đang chờ). Ẩn với học viên/phụ huynh.
    // Wave 5: gating chi tiết theo vai trò trong trung tâm cho các mục tài chính/lương.
    if (item.url === '/organization/finance' || item.url?.startsWith('/organization/finance/')) {
      return !isStudent && !isParent && canViewFinance;
    }
    if (item.url === '/organization/payroll' || item.url?.startsWith('/organization/payroll/')) {
      // The payroll page is a MANAGEMENT surface (create/compute/approve) → owner/manager only.
      // An accountant reads payroll cost via the Finance reports, so they don't get this nav item.
      return !isStudent && !isParent && canManagePayroll;
    }
    if (item.url === '/organization/my-payslips') {
      return !isStudent && !isParent && isMemberTutor;
    }
    if (item.url === '/organization' || item.url?.startsWith('/organization/')) {
      return !isStudent && !isParent && canSeeOrgNav;
    }
    // Tài khoản ngân hàng của TRUNG TÂM: chỉ owner/manager quản lý (học phí chuyển
    // vào tài khoản trung tâm, không phải tài khoản cá nhân của gia sư).
    if (item.url === '/settings/organization/bank-accounts') {
      return !isStudent && !isParent && canManageOrg;
    }

    // Only students can see /my-reports and /my-payments
    if (item.url && (item.url === '/my-reports' || item.url === '/my-payments' || item.url === '/my-notifications')) {
      return isStudent;
    }

    // QR check-in điểm danh chỉ dành cho học viên (giáo viên dùng màn hình QR riêng)
    if (item.url === '/attendance/check-in') {
      return isStudent;
    }

    // Students can see /dashboard (Tổng quan)
    if (isStudent && item.url === '/dashboard') {
      return true;
    }

    // Students should NOT see these items (based on PLAN-CAPABILITIES-AND-ROLES.md)
    if (isStudent) {
      const restrictedItems = [
        '/reports',              // Báo cáo (cần capability)
        '/notifications',        // Quản lý thông báo (cần capability)
        '/login-activity',       // Lịch sử đăng nhập (cần capability)
        '/students',             // Quản lý học viên (chỉ giáo viên)
        '/users',                // Quản lý giáo viên (chỉ tutor)
        '/assignment-types',     // Loại bài tập (chỉ giáo viên)
        '/subjects',             // Môn học (chỉ giáo viên)
        '/grade-levels',         // Cấp độ/Khối (chỉ giáo viên)
        '/grade-types',          // Loại điểm (chỉ giáo viên)
        '/payments',             // Quản lý học phí (chỉ tutor)
        '/payment-requests',     // Yêu cầu thanh toán (chỉ giáo viên)
        '/settings/payment',     // Cài đặt thông tin ngân hàng (chuyển sang tài khoản trung tâm)
      ];

      // Check if URL is restricted
      if (item.url && restrictedItems.some(restricted => item.url?.startsWith(restricted))) {
        return false;
      }

      // Check if title matches restricted items
      const restrictedTitles = [
        'Báo cáo',           // Note: "Tổng quan" (dashboard) is allowed, but "Báo cáo" (reports) is not
        'Học phí',            // Quản lý học phí (chỉ tutor)
        'Giáo viên',
        'Học viên',           // Quản lý học viên (chỉ tutor)
        'Nhật ký truy cập',   // Lịch sử đăng nhập (cần capability)
        'Cấu hình',
      ];

      if (restrictedTitles.includes(item.title)) {
        return false;
      }

      // Hide news/notifications in QUẢN LÝ HỆ THỐNG section for students
      if (item.title === 'Bảng tin' && sectionLabel === 'QUẢN LÝ HỆ THỐNG') {
        return false;
      }

      // Hide reminders in QUẢN LÝ HỆ THỐNG section for students (students see it in NỘI DUNG HỌC TẬP)
      if (item.title === 'Nhắc nhở' && sectionLabel === 'QUẢN LÝ HỆ THỐNG') {
        return false;
      }

      // Hide all create/edit pages for students
      if (item.url && (item.url.includes('/create') || item.url.includes('/edit'))) {
        return false;
      }

      // Hide config sub-items
      if (item.url && (
        item.url.startsWith('/assignment-types') ||
        item.url.startsWith('/subjects') ||
        item.url.startsWith('/grade-levels') ||
        item.url.startsWith('/grade-types')
      )) {
        return false;
      }

      // Học viên LUÔN thấy các màn hình lõi (chỉ đọc) của CHÍNH MÌNH, không phụ
      // thuộc vào các quyền view_*. Lý do:
      //   1) Hệ thống phân quyền hiện chưa sinh các quyền view_class::room /
      //      view_schedule / view_assignment / view_grade / view_attendance
      //      → nếu gate theo các quyền này, học viên mất toàn bộ menu học tập
      //      dù trang vẫn render đúng dữ liệu của họ.
      //   2) Quyết định sản phẩm: một người dùng luôn thấy DỮ LIỆU CỦA CHÍNH MÌNH.
      // Các mục quản lý / tạo-sửa vẫn bị chặn bởi restrictedItems + create/edit ở trên.
      const studentCoreItems = [
        '/classes',      // Lớp học (chỉ đọc)
        '/calendar',     // Lịch học của tôi
        '/assignments',  // Bài tập (chỉ đọc)
        '/grades',       // Điểm số của tôi
        '/attendance',   // Điểm danh của tôi
        '/reminders',    // Nhắc nhở
      ];
      if (item.url && studentCoreItems.includes(item.url)) {
        return true;
      }
    }

    // Hide reminders in NỘI DUNG HỌC TẬP section for non-students (tutors see it in QUẢN LÝ HỆ THỐNG)
    if (!isStudent && item.title === 'Nhắc nhở' && sectionLabel === 'NỘI DUNG HỌC TẬP') {
      return false;
    }

    // Special handling for reminders menu (non-students only — học viên đã được
    // xử lý ở khối studentCoreItems bên trên và luôn thấy "Nhắc nhở").
    // Giáo viên: Luôn hiện menu nhắc nhở.
    if (item.url === '/reminders') {
      return true;
    }

    // Xuất/Nhập dữ liệu: chỉ hiện khi user có ít nhất 1 quyền import HOẶC export.
    // Ẩn hẳn menu với user không đủ quyền (thay vì để họ vào trang rồi thấy trắng).
    if (item.url === '/import-export') {
      return canImportData(user) || canExportData(user);
    }

    // Permission-based checks
    const permissionMap: Record<string, { action: string; resource: string }> = {
      '/classes': { action: 'view', resource: 'class::room' },
      '/assignments': { action: 'view', resource: 'assignment' },
      '/attendance': { action: 'view', resource: 'attendance' },
      '/grades': { action: 'view', resource: 'grade' },
      '/students': { action: 'view', resource: 'student' },
      '/users': { action: 'view', resource: 'user' },
      '/payments': { action: 'view', resource: 'payment' },
      '/notifications': { action: 'view', resource: 'notification' },
      '/learning-resources': { action: 'view', resource: 'learning::resource' },
      '/lesson-notes': { action: 'view', resource: 'lesson::note' },
      '/calendar': { action: 'view', resource: 'schedule' },
      '/login-activity': { action: 'view', resource: 'login_activity' },
    };

    if (item.url && permissionMap[item.url]) {
      const { action, resource } = permissionMap[item.url];
      return can(action, resource) || can(`${action}_any`, resource);
    }

    // Check create permissions
    const createPermissionMap: Record<string, { action: string; resource: string }> = {
      '/classes/create': { action: 'create', resource: 'class::room' },
      '/students/create': { action: 'create', resource: 'student' },
      '/assignments/create': { action: 'create', resource: 'assignment' },
      '/attendance/take': { action: 'create', resource: 'attendance' },
      '/lesson-notes/create': { action: 'create', resource: 'lesson::note' },
      '/payments/create': { action: 'create', resource: 'payment' },
      '/notifications/create': { action: 'create', resource: 'notification' },
      '/users/create': { action: 'create', resource: 'user' },
    };

    if (item.url && createPermissionMap[item.url]) {
      const { action, resource } = createPermissionMap[item.url];
      return can(action, resource);
    }

    // Default: show if no specific restrictions
    return true;
  };

  /**
   * Filter menu items based on permissions
   */
  const filterMenuItems = (items: MenuItem[], sectionLabel?: string): MenuItem[] => {
    return items
      .filter(item => {
        // Check parent item
        if (!shouldShowMenuItem(item, sectionLabel)) {
          return false;
        }

        // If item has sub-items, filter them
        if (item.items && item.items.length > 0) {
          const filteredSubItems = item.items.filter(subItem => 
            shouldShowMenuItem(subItem, sectionLabel)
          );
          
          // Only show parent if it has visible sub-items
          return filteredSubItems.length > 0;
        }

        return true;
      })
      .map(item => {
        // If item has sub-items, filter them
        if (item.items && item.items.length > 0) {
          return {
            ...item,
            items: item.items.filter(subItem => shouldShowMenuItem(subItem, sectionLabel)),
          };
        }
        return item;
      });
  };

  /**
   * Reorganize menu sections for students
   */
  const reorganizeMenuForStudents = (sections: MenuSection[]): MenuSection[] => {
    if (!isStudent) {
      // For non-students, just filter normally
      return sections
        .map(section => ({
          ...section,
          items: filterMenuItems(section.items, section.label),
        }))
        .filter(section => section.items.length > 0);
    }

    // For students, reorganize menu structure
    const reorganized: MenuSection[] = [];

    // 1. MENU CHÍNH: Tổng quan, Bảng tin, Báo cáo học tập
    const mainMenuItems: MenuItem[] = [];
    sections.forEach(section => {
      section.items.forEach(item => {
        if (
          item.url === '/dashboard' ||
          item.url === '/my-reports' ||
          item.url === '/my-notifications'
        ) {
          if (shouldShowMenuItem(item, section.label)) {
            mainMenuItems.push(item);
          }
        }
      });
    });
    // Sort: Tổng quan, Bảng tin, Báo cáo học tập
    mainMenuItems.sort((a, b) => {
      const order: Record<string, number> = {
        '/dashboard': 1,
        '/my-notifications': 2,
        '/my-reports': 3,
      };
      return (order[a.url || ''] || 999) - (order[b.url || ''] || 999);
    });
    if (mainMenuItems.length > 0) {
      reorganized.push({
        label: 'MENU CHÍNH',
        items: mainMenuItems,
      });
    }

    // 2. HỌC TẬP: Lịch học, Lớp học, Bài tập, Điểm số, Điểm danh, Điểm danh (QR), Nhắc nhở
    const studyMenuItems: MenuItem[] = [];
    sections.forEach(section => {
      section.items.forEach(item => {
        if (item.url === '/classes' || item.url === '/calendar' || item.url === '/assignments' || item.url === '/attendance' || item.url === '/attendance/check-in' || item.url === '/grades' || item.url === '/reminders') {
          if (shouldShowMenuItem(item, section.label)) {
            studyMenuItems.push(item);
          }
        }
      });
    });
    // Sort (Lịch học + Lớp học ưu tiên cao — nhu cầu hàng ngày của học viên):
    // Lịch học, Lớp học, Bài tập, Điểm số, Điểm danh, Điểm danh (QR), Nhắc nhở
    studyMenuItems.sort((a, b) => {
      const order: Record<string, number> = { '/calendar': 1, '/classes': 2, '/assignments': 3, '/grades': 4, '/attendance': 5, '/attendance/check-in': 6, '/reminders': 7 };
      return (order[a.url || ''] || 999) - (order[b.url || ''] || 999);
    });
    if (studyMenuItems.length > 0) {
      reorganized.push({
        label: 'HỌC TẬP',
        items: studyMenuItems,
      });
    }

    // 3. CÀI ĐẶT: Hồ sơ, Bảo mật, Bảng tin, Học phí
    // Lưu ý: /settings/payment chỉ dành cho tutor (để nhận học phí), không dành cho student
    const settingsMenuItems: MenuItem[] = [];
    sections.forEach(section => {
      if (section.label === 'CÀI ĐẶT') {
        section.items.forEach(item => {
          if (
            item.url === '/settings/profile' ||
            item.url === '/settings/security' ||
            item.url === '/settings/notifications' ||
            item.url === '/my-payments'
          ) {
            if (shouldShowMenuItem(item, section.label)) {
              settingsMenuItems.push(item);
            }
          }
        });
      }
    });
    // Sort: Hồ sơ, Bảo mật, Bảng tin, Học phí
    settingsMenuItems.sort((a, b) => {
      const order: Record<string, number> = {
        '/settings/profile': 1,
        '/settings/security': 2,
        '/settings/notifications': 3,
        '/my-payments': 4,
      };
      return (order[a.url || ''] || 999) - (order[b.url || ''] || 999);
    });
    if (settingsMenuItems.length > 0) {
      reorganized.push({
        label: 'CÀI ĐẶT',
        items: settingsMenuItems,
      });
    }

    return reorganized;
  };

  /**
   * Filter menu sections - remove sections with no visible items
   */
  const filterMenuSections = (sections: MenuSection[]): MenuSection[] => {
    // Parents get their own dedicated menu (Family portal + account settings),
    // not the tutor/student navigation.
    if (isParent) {
      return PARENT_NAV_DATA;
    }

    // For students, reorganize menu structure
    if (isStudent) {
      return reorganizeMenuForStudents(sections);
    }

    // For non-students, just filter normally
    return sections
      .map(section => ({
        ...section,
        items: filterMenuItems(section.items, section.label),
      }))
      .filter(section => section.items.length > 0);
  };

  return {
    isStudent,
    shouldShowMenuItem,
    filterMenuItems,
    filterMenuSections,
  };
}

