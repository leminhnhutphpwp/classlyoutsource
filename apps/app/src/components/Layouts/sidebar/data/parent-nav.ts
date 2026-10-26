import * as Icons from "../icons";
import type { MenuSection } from "@/lib/menu-permissions";

/**
 * Sidebar for the `parent` role. Parents don't get the tutor/student menus —
 * they only manage their children (the Family portal) plus their own account
 * settings. Consumed by `useMenuPermissions().filterMenuSections` when the
 * signed-in user is a parent.
 */
export const PARENT_NAV_DATA: MenuSection[] = [
  {
    label: "GIA ĐÌNH",
    items: [
      {
        title: "Con của tôi",
        icon: Icons.UserGroup,
        url: "/family",
        items: [],
      },
    ],
  },
  {
    label: "CÀI ĐẶT",
    items: [
      {
        title: "Hồ sơ",
        icon: Icons.User,
        url: "/settings/profile",
        items: [],
      },
      {
        title: "Nhật ký truy cập",
        icon: Icons.Authentication,
        url: "/settings/security",
        items: [],
      },
      {
        title: "Thông báo",
        icon: Icons.Bell,
        url: "/settings/notifications",
        items: [],
      },
    ],
  },
];
