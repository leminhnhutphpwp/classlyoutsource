import { PageSkeleton } from "@/components/ui/loading";

export default function Loading() {
  return (
    <div className="p-4 sm:p-6">
      <PageSkeleton showHeader showFilters showContent />
    </div>
  );
}
