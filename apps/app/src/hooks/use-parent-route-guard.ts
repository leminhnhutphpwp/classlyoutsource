import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthContext } from "@/contexts/auth-context";

/**
 * Fail-closed route guard for the `parent` role.
 *
 * Parents only get the Family portal + their own account settings (see
 * `PARENT_NAV_DATA` and `menu-permissions.filterMenuSections`). The sidebar
 * already hides tutor/student features, but a parent could still reach them by
 * typing a URL. This hook redirects any such direct navigation back to the
 * family portal so tutor/student surfaces are closed at the UI layer too — not
 * just at the API.
 *
 * Mounted once in `ConditionalLayout` so it covers every authenticated page.
 */
// Only the surfaces the parent sidebar (PARENT_NAV_DATA) actually exposes.
// Note: /settings/payment is intentionally excluded — it is the tutor's
// bank-account config for *receiving* tuition, not a parent surface.
const PARENT_ALLOWED_PREFIXES = [
  "/family",
  "/profile",
  "/403",
  "/settings/profile",
  "/settings/security",
  "/settings/notifications",
];

export function useParentRouteGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, isAuthenticated } = useAuthContext();

  useEffect(() => {
    if (loading || !isAuthenticated) return;
    if (user?.role !== "parent") return;
    if (!pathname) return;

    // Auth pages + root are handled by the middleware / HomePage redirect.
    if (pathname === "/" || pathname === "/auth" || pathname.startsWith("/auth/")) {
      return;
    }

    const allowed = PARENT_ALLOWED_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );

    if (!allowed) {
      router.replace("/family");
    }
  }, [pathname, user, loading, isAuthenticated, router]);
}
