"use client";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

export function TakeAttendanceButton() {
  return (
    <Link
      href="/attendance/take"
      className="inline-flex items-center rounded-lg bg-success px-4 py-2 font-medium text-white transition-colors hover:bg-success/90"
    >
      <CheckCircleIcon className="mr-2 h-4 w-4" />
      Điểm danh
    </Link>
  );
}
