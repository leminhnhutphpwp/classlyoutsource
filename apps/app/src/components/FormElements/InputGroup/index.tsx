import { cn } from "@/lib/utils";
import type React from "react";
import { type HTMLInputTypeAttribute, useId, useState } from "react";
import DateInput from "../DateInput";
import MonthInput from "../MonthInput";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

type InputGroupProps = {
  className?: string;
  label?: string;
  placeholder?: string;
  type: HTMLInputTypeAttribute;
  fileStyleVariant?: "style1" | "style2";
  required?: boolean;
  disabled?: boolean;
  active?: boolean;
  handleChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  value?: string;
  name?: string;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  height?: "sm" | "default";
  defaultValue?: string;
  step?: string | number;
  min?: string | number;
  max?: string | number;
  helperText?: string;
  error?: string;
  noLabel?: boolean;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
};

const InputGroup: React.FC<InputGroupProps> = ({
  className,
  label,
  type,
  placeholder,
  required,
  disabled,
  active,
  handleChange,
  icon,
  helperText,
  error,
  noLabel,
  ...props
}) => {
  const id = useId();
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  // Force icon to left if it is a password field to make room for the toggle button
  const effectiveIconPosition = isPassword ? "left" : (props.iconPosition || "right");
  const inputType = isPassword ? (showPassword ? "text" : "password") : type;

  // Use DateInput for date type to avoid double icon issue
  if (type === "date") {
    return (
      <DateInput
        className={className}
        label={label}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        handleChange={handleChange}
        value={props.value}
        name={props.name}
        icon={icon}
        iconPosition={props.iconPosition}
        min={props.min as string}
        max={props.max as string}
        error={error}
      />
    );
  }

  // Use MonthInput for month type to avoid double icon issue
  if (type === "month") {
    return (
      <MonthInput
        className={className}
        label={label}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        handleChange={handleChange}
        value={props.value}
        name={props.name}
        icon={icon}
        iconPosition={props.iconPosition}
        min={props.min as string}
        max={props.max as string}
        error={error}
      />
    );
  }

  return (
    <div className={`space-y-2 ${className || ""}`}>
      {!noLabel && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-gray-900 dark:text-white"
        >
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </label>
      )}

      <div className="relative">
        <input
          id={id}
          type={inputType}
          name={props.name}
          placeholder={placeholder}
          onChange={handleChange}
          value={props.value}
          defaultValue={props.defaultValue}
          step={props.step}
          min={props.min}
          max={props.max}
          className={clsx(
            "w-full rounded-lg border border-gray-300 bg-white text-gray-900 outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:opacity-70 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-primary",
            error && "border-red-500 focus:border-red-500 dark:border-red-400 dark:focus:border-red-400",
            type === "file"
              ? getFileStyles(props.fileStyleVariant!)
              : props.height === "sm"
                ? "h-[41px] px-4 placeholder:text-gray-400"
                : type === "number"
                  ? "h-[41px] px-4 placeholder:text-gray-400 cursor-text"
                  : "h-[41px] px-4 placeholder:text-gray-400",
            effectiveIconPosition === "left" && icon && "!pl-15",
            // For number type with icon on right, add extra padding to avoid overlap with spinner
            effectiveIconPosition === "right" && icon && (type === "number" ? "pr-16" : "pr-12"),
            // If password, we always have a toggle on the right, so ensure padding right
            isPassword && "pr-12",
            // Hide number input spinners when icon is on right
            type === "number" && effectiveIconPosition === "right" && "[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          )}
          required={required}
          disabled={disabled}
          data-active={active}
          {...(props.inputProps || {})}
        />

        {icon && (
          <span
            className={cn(
              "absolute top-1/2 -translate-y-1/2 pointer-events-none [&_svg]:h-5 [&_svg]:w-5",
              effectiveIconPosition === "left" ? "left-4" : "right-4"
            )}
          >
            {icon}
          </span>
        )}

        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none dark:text-gray-400 dark:hover:text-gray-200"
            tabIndex={-1}
          >
            {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
          </button>
        )}
      </div>

      {helperText && (
        <p className="text-xs text-gray-500 dark:text-gray-400">{helperText}</p>
      )}

      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
};

export default InputGroup;

function getFileStyles(variant: "style1" | "style2") {
  switch (variant) {
    case "style1":
      return `file:mr-5 file:border-collapse file:cursor-pointer file:border-0 file:border-r file:border-solid file:border-stroke file:bg-[#E2E8F0] file:px-6.5 file:py-[13px] file:text-body-sm file:font-medium file:text-dark-5 file:hover:bg-primary file:hover:bg-opacity-10 dark:file:border-dark-3 dark:file:bg-white/30 dark:file:text-white`;
    default:
      return `file:mr-4 file:rounded file:border-[0.5px] file:border-stroke file:bg-stroke file:px-2.5 file:py-1 file:text-body-xs file:font-medium file:text-dark-5 file:focus:border-primary dark:file:border-dark-3 dark:file:bg-white/30 dark:file:text-white px-3 py-[9px]`;
  }
}
