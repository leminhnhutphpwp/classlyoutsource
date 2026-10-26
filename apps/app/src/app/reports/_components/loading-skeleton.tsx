"use client";

import { CardSkeleton, GridSkeleton } from "@/components/ui/loading";

interface LoadingSkeletonProps {
  count?: number;
  cols?: string;
}

export default function LoadingSkeleton({ count = 3, cols }: LoadingSkeletonProps) {
  // If cols provided, wrap in grid (for standalone usage)
  if (cols) {
    return (
      <GridSkeleton
        count={count}
        cols={{
          mobile: 1,
          tablet: 2,
          desktop: cols.includes("md:grid-cols-2") ? 2 : cols.includes("md:grid-cols-3") ? 3 : 3,
        }}
      />
    );
  }

  // Return items only to be used inside existing grid container
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} showAvatar={true} lines={1} />
      ))}
    </>
  );
}

