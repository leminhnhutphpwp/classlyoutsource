"use client";
import ProtectedRoute from "@/components/Auth/ProtectedRoute";
import { CreateClassForm } from "./_components/create-class-form";
import { useAuthContext } from "@/contexts/auth-context";
import { useResourceGuard } from "@/lib/permission-guards";
import Button from "@/components/Common/Button";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { useGoBack } from "@/hooks/use-go-back";

export default function CreateClassPage() {
  const { user } = useAuthContext();
  const handleGoBack = useGoBack('/classes');
  
  // Use resource guard to protect this route
  const { hasAccess, isChecking } = useResourceGuard(
    user,
    'create',
    'class::room',
    '/403'
  );
  
  // Show nothing while checking or redirecting
  if (isChecking || !hasAccess) {
    return null;
  }
  
  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <Button
            onClick={handleGoBack}
            variant="outline"
            size="sm"
            icon={<ArrowLeftIcon />}
            className="w-full sm:w-auto justify-center"
          >
            Quay lại
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">Tạo lớp học mới</h1>
            <p className="text-gray-600 dark:text-gray-400 break-words">Thêm lớp học mới vào hệ thống</p>
          </div>
        </div>

        {/* Form */}
        <div className="max-w-2xl">
          <CreateClassForm />
        </div>
      </div>
    </ProtectedRoute>
  );
}
