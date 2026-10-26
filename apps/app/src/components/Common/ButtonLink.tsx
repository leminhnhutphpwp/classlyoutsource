import Link, { LinkProps } from "next/link";
import { ReactNode, memo } from "react";
import { cn } from "@/lib/utils";
import { useLockContext } from "@/contexts/lock-context";

export interface ButtonLinkProps extends Omit<LinkProps, "href"> {
  href: string;
  variant?: "primary" | "secondary" | "danger" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
  className?: string;
  disabled?: boolean;
  /**
   * Nếu true, ButtonLink sẽ tự block navigation khi tài khoản bị khóa thao tác.
   * Dùng cho các link mang tính hành động (tạo/sửa/xóa).
   */
  lockAware?: boolean;
  // Next.js Link optimization props
  prefetch?: boolean;
  scroll?: boolean;
  shallow?: boolean;
}

function ButtonLinkComponent({
  variant = "primary",
  size = "md",
  className,
  children,
  icon,
  iconPosition = "left",
  lockAware = true,
  disabled,
  prefetch = true, // Enable prefetching by default for better performance
  scroll = true, // Enable smooth scroll to top by default
  shallow = false,
  ...props
}: ButtonLinkProps) {
  const { actionsLocked } = useLockContext();
  const isDisabled = disabled || (lockAware && actionsLocked);
  const baseStyles = "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-offset-1 whitespace-nowrap";

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

  const iconElement = icon && (
    <span className={iconSizes[size]}>
      {icon}
    </span>
  );

  if (isDisabled) {
    return (
      <button
        type="button"
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          "cursor-not-allowed opacity-60",
          className
        )}
        disabled
        title="Tài khoản của bạn đang bị tạm khóa thao tác. Vui lòng xem thông báo khóa để biết thêm chi tiết."
      >
        {iconPosition === "left" && iconElement}
        {children}
        {iconPosition === "right" && iconElement}
      </button>
    );
  }

  return (
    <Link
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        className
      )}
      prefetch={prefetch}
      scroll={scroll}
      shallow={shallow}
      {...props}
    >
      {iconPosition === "left" && iconElement}
      {children}
      {iconPosition === "right" && iconElement}
    </Link>
  );
}

const ButtonLink = memo(ButtonLinkComponent);
export default ButtonLink;

