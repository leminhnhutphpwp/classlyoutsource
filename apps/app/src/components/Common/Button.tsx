import { ButtonHTMLAttributes, ReactNode, memo } from "react";
import { cn } from "@/lib/utils";
import { useLockContext } from "@/contexts/lock-context";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
  /**
   * Nếu true, button sẽ tự động bị disable khi tài khoản đang bị khóa thao tác (ACCOUNT_ACTIONS_LOCKED / ALL).
   * Dùng cho các nút hành động (tạo/sửa/xóa...). Với nút purely UI có thể set = false.
   */
  lockAware?: boolean;
}

function ButtonComponent({
  variant = "primary",
  size = "md",
  className,
  children,
  disabled,
  loading,
  icon,
  iconPosition = "left",
  lockAware = true,
  ...props
}: ButtonProps) {
  const { actionsLocked } = useLockContext();

  const baseStyles = "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap";

  const variants = {
    primary: "bg-primary text-white hover:bg-primary/90 focus:ring-primary",
    secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 focus:ring-gray-500",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
    outline: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 focus:ring-gray-500",
    ghost: "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 focus:ring-gray-500",
  };

  // All variants use the shared 41px control height; flex centers content vertically.
  const sizes = {
    sm: "h-[41px] px-3 text-sm gap-1.5",
    md: "h-[41px] px-4 text-sm gap-2",
    lg: "h-[41px] px-6 text-base gap-2",
  };

  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-5 w-5",
  };

  const iconElement = icon && !loading && (
    <span className={iconSizes[size]}>
      {icon}
    </span>
  );

  const isDisabled = disabled || loading || (lockAware && actionsLocked);
  const lockTitle =
    lockAware && actionsLocked
      ? "Tài khoản của bạn đang bị tạm khóa thao tác. Vui lòng xem lại thông báo khóa ở cuối màn hình."
      : undefined;

  return (
    <button
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        loading && "relative",
        className
      )}
      disabled={isDisabled}
      title={lockTitle}
      {...props}
    >
      {loading && (
        <svg
          className={cn("animate-spin", iconSizes[size])}
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {iconPosition === "left" && iconElement}
      {children}
      {iconPosition === "right" && iconElement}
    </button>
  );
}

const Button = memo(ButtonComponent);
export default Button;

