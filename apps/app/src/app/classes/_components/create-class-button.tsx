"use client";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

export function CreateClassButton() {
  return (
    <Link
      href="/classes/create"
      className="inline-flex items-center rounded-lg bg-primary px-4 py-2 font-medium text-white transition-colors hover:bg-primary/90"
    >
      <ArrowPathIcon className="mr-2 h-4 w-4" />
      Tạo lớp học
    </Link>
  );
}
