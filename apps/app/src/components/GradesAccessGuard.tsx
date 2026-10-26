"use client";
import { useAuthorization } from "@/lib/authz";

export default function GradesAccessGuard({ children }: { children: React.ReactNode }) {
  const { can } = useAuthorization();
  if (!(can("view", "grade") || can("view_any", "grade"))) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
        <h3 className="font-medium mb-2">Không có quyền</h3>
        <p>Bạn không có quyền xem điểm.</p>
      </div>
    );
  }
  return <>{children}</>;
}
