import { memo } from "react";
import { cn } from "@/lib/utils";
import { cva } from "class-variance-authority";
import Link from "next/link";
import { useSidebarContext } from "./sidebar-context";

// Active và hover ở nhiều theme dùng CÙNG màu chữ (vd theme đỏ: cả hai đều #EF4444) và
// hai nền xám chỉ lệch nhau một sắc độ (#F3F4F6 vs #F9FAFB) — rê chuột lên một mục trông
// y hệt mục đang mở. Màu là biến theme dùng chung nên không sửa được ở đây; thay vào đó
// gắn cho active hai dấu hiệu mà hover không bao giờ có: thanh chỉ báo bên trái + chữ đậm.
const menuItemBaseStyles = cva(
  "relative rounded-lg font-medium transition-all duration-200 m-0",
  {
    variants: {
      isActive: {
        true: "font-semibold before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-r before:bg-current before:content-[''] [background-color:var(--sidebar-active-bg,var(--color-primary-light,#F87171))] [color:var(--sidebar-text-active,#FFFFFF)] hover:[background-color:var(--sidebar-active-bg,var(--color-primary-light,#F87171))] dark:[background-color:var(--sidebar-active-bg-dark,#4B5563)] dark:[color:var(--sidebar-text-active-dark,#FFFFFF)] dark:hover:[background-color:var(--sidebar-active-bg-dark,#4B5563)]",
        false:
          "[color:var(--sidebar-text,#FFFFFF)] hover:[background-color:var(--sidebar-hover-bg,var(--color-primary-dark,#DC2626))] hover:[color:var(--sidebar-text-hover,#FFFFFF)] dark:[color:var(--sidebar-text-dark,#FFFFFF)] dark:hover:[background-color:var(--sidebar-hover-bg-dark,#374151)] dark:hover:[color:var(--sidebar-text-hover-dark,#FFFFFF)]",
      },
    },
    defaultVariants: {
      isActive: false,
    },
  },
);

function MenuItemComponent(
  props: {
    className?: string;
    children: React.ReactNode;
    isActive: boolean;
  } & ({ as?: "button"; onClick: () => void } | { as: "link"; href: string }),
) {
  const { toggleSidebar, isMobile } = useSidebarContext();

  if (props.as === "link") {
    return (
      <Link
        href={props.href}
        // Close sidebar on clicking link if it's mobile
        onClick={() => isMobile && toggleSidebar()}
        className={cn(
          menuItemBaseStyles({
            isActive: props.isActive,
            className: "flex w-full items-center border-0",
          }),
          props.className,
        )}
      >
        {props.children}
      </Link>
    );
  }

  return (
    <button
      onClick={props.onClick}
      aria-expanded={props.isActive}
      type="button"
      className={cn(
        menuItemBaseStyles({
          isActive: props.isActive,
          className: "flex w-full items-center border-0",
        }),
        props.className
      )}
    >
      {props.children}
    </button>
  );
}

export const MenuItem = memo(MenuItemComponent);
