"use client";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

export function CreateAssignmentButton() {
  return (
    <Link
      href="/assignments/create"
      className="inline-flex items-center rounded-lg bg-accent px-4 py-2 font-medium text-white transition-colors hover:bg-accent/90"
    >
      <ArrowPathIcon className="mr-2 h-4 w-4" />
      Create Assignment
    </Link>
  );
}
