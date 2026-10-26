"use client";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/**
 * `/family/[studentId]` has no content of its own — send the parent straight to
 * the child's schedule tab (the first tab in the child layout).
 */
export default function ChildIndexPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params?.studentId as string;

  useEffect(() => {
    if (studentId) {
      router.replace(`/family/${studentId}/schedule`);
    }
  }, [studentId, router]);

  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}
