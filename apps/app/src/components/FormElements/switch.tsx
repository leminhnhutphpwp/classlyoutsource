import { CheckIcon, XIcon } from "@/assets/icons";
import { cn } from "@/lib/utils";
import { useId } from "react";

type PropsType = {
  withIcon?: boolean;
  background?: "dark" | "light";
  backgroundSize?: "sm" | "default";
  name?: string;
  checked?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  label?: string;
  error?: string;
};

export function Switch({
  background,
  withIcon,
  backgroundSize,
  name,
  checked,
  onChange,
  disabled,
  label,
  error,
}: PropsType) {
  const id = useId();

  return (
    <div className="w-full">
      <label
        htmlFor={id}
        className={cn(
          "flex cursor-pointer select-none items-center gap-2",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <div className="relative">
          <input
            type="checkbox"
            name={name}
            id={id}
            checked={checked}
            onChange={onChange}
            disabled={disabled}
            className="peer sr-only"
          />
          <div
            className={cn("h-5 rounded-full transition", {
              "h-8 w-14": backgroundSize === "default",
              "w-[3.5rem]": backgroundSize !== "default",
              "bg-gray-3 dark:bg-[#5A616B]": !checked && background !== "dark",
              "bg-primary": checked && background !== "dark",
              "bg-[#212B36] dark:bg-primary": background === "dark",
              "border-red-500 dark:border-red-400": error,
            })}
          />

          <div
            className={cn(
              "absolute flex items-center justify-center rounded-full shadow-switch-2 transition-all duration-200 ease-in-out peer-checked:[&_.check-icon]:block peer-checked:[&_.x-icon]:hidden",
              {
                "top-1 size-6 shadow-switch-1": backgroundSize === "default",
                "-top-1 size-7": backgroundSize !== "default",
              },
              backgroundSize === "default"
                ? checked
                  ? "right-1 translate-x-0 bg-white dark:bg-white"
                  : "left-1 translate-x-0 bg-white"
                : checked
                  ? "right-0 translate-x-0 bg-white dark:bg-white"
                  : "left-0 translate-x-0 bg-white",
            )}
          >
            {withIcon && (
              <>
                <span className="check-icon hidden">
                  <CheckIcon className="fill-white dark:fill-dark" />
                </span>
                <span className="x-icon">
                  <XIcon />
                </span>
              </>
            )}
          </div>
        </div>
        {label && (
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {label}
          </span>
        )}
      </label>
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
