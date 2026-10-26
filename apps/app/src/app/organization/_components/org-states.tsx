"use client";

import { PageSkeleton } from "@/components/ui/loading";

/** Skeleton dùng chung cho các trang trung tâm khi đang tải trạng thái. */
export function OrgLoadingSkeleton() {
  return <PageSkeleton showHeader showContent />;
}
