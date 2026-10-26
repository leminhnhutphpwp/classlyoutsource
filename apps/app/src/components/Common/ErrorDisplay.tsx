import LockedContent from "@/components/Common/LockedContent";
import { useLockContext } from "@/contexts/lock-context";

interface ErrorDisplayProps {
    error?: string;
    loading?: boolean;
    title?: string;
    onRetry?: () => void;
    // Lock-related props
    isLocked?: boolean;
    lockDescription?: string;
    lockDefaultMessage?: string;
    // Permission-related props
    hasPermission?: boolean;
}

/**
 * Hiển thị lỗi với giao diện phù hợp
 * - Nếu tài khoản bị lock: hiển thị LockedContent
 * - Nếu không có permission: hiển thị LockedContent
 * - Nếu là lỗi khác: hiển thị error box đơn giản
 */
export function renderErrorDisplay({ 
    error, 
    loading = false, 
    title = "Lỗi tải dữ liệu", 
    onRetry,
    isLocked,
    lockDescription,
    lockDefaultMessage,
    hasPermission
}: ErrorDisplayProps) {
    if (loading) return null;

    // Check if account is locked
    if (isLocked) {
        return (
            <LockedContent
                title={title}
                description={lockDescription}
                defaultMessage={lockDefaultMessage}
            />
        );
    }

    // Check if user doesn't have permission
    if (hasPermission === false) {
        return (
            <LockedContent
                title={title}
                description={undefined} // No custom description; LockedContent shows its own lock message
            />
        );
    }

    // If no error, return null
    if (!error) return null;

    return (
        <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            <h3 className="font-medium mb-2">{title}</h3>
            <p>{error}</p>
            {onRetry && (
                <button
                    onClick={onRetry}
                    className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                >
                    Thử lại
                </button>
            )}
        </div>
    );
}

/**
 * Component wrapper cho renderErrorDisplay
 */
export default function ErrorDisplay(props: ErrorDisplayProps) {
    return renderErrorDisplay(props);
}

/**
 * Hook helper để sử dụng ErrorDisplay với lock context
 */
export function useErrorDisplay(title: string) {
    const { actionsLocked, planFeatureMessage } = useLockContext();
    
    return {
        renderError: (error?: string, onRetry?: () => void, hasPermission?: boolean) => {
            return renderErrorDisplay({
                error,
                title,
                onRetry,
                isLocked: actionsLocked || !!planFeatureMessage,
                lockDescription: planFeatureMessage ? undefined : "Tài khoản của bạn đang bị tạm khóa.",
                lockDefaultMessage: "Trong thời gian khóa, bạn chỉ có thể xem mà không thể thực hiện các thao tác.",
                hasPermission,
            });
        }
    };
}
