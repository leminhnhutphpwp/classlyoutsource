import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <h1 className="text-4xl font-bold text-dark dark:text-white">403</h1>
      <p className="mt-2 text-dark-4 dark:text-dark-6">Bạn không có quyền truy cập trang này.</p>
      <Link href="/" className="mt-6 inline-flex rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary/90">Về trang chủ</Link>
    </div>
  );
}


