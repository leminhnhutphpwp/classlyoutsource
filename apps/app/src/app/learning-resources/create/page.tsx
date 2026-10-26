"use client";
import { useRouter } from "next/navigation";
import { useGoBack } from "@/hooks/use-go-back";
import { useAuthContext } from "@/contexts/auth-context";
import { useResourceGuard } from "@/lib/permission-guards";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import Button from "@/components/Common/Button";
import CreateResourceForm from "@/components/LearningResources/CreateResourceForm";

export default function CreateLearningResourcePage() {
  const router = useRouter();
  const { user } = useAuthContext();
  const handleGoBack = useGoBack('/learning-resources');

  // Use resource guard to protect this route
  const { hasAccess, isChecking } = useResourceGuard(
    user,
    'create',
    'learning::resource',
    '/403'
  );

  // Show nothing while checking or redirecting (after all hooks)
  if (isChecking || !hasAccess) {
    return null;
  }

  const handleSuccess = () => {
    // Redirect to list page after successful creation
    router.push('/learning-resources');
  };

  return (
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
          <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white truncate">Tạo tài liệu mới</h1>
          <p className="text-dark-4 dark:text-dark-6 mt-1 break-words">
            Thêm tài liệu học tập mới vào hệ thống
          </p>
        </div>
      </div>

      {/* Reusable Form */}
      <div className="max-w-2xl rounded-lg bg-white p-6 dark:bg-gray-800">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Thông tin cơ bản</h2>
        <CreateResourceForm
          onSuccess={handleSuccess}
          onCancel={handleGoBack}
        />
      </div>
    </div>
  );
}
