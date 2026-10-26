"use client";
import Link from "next/link";
import { PlusIcon } from "@heroicons/react/24/outline";

export function CreateStudentButton() {
  return (
    <Link
      href="/students/create"
      className="inline-flex items-center rounded-lg bg-primary px-4 py-2 font-medium text-white transition-colors hover:bg-primary/90"
    >
      <PlusIcon className="mr-2 h-4 w-4" />
      Thêm học viên
    </Link>
  );
}
