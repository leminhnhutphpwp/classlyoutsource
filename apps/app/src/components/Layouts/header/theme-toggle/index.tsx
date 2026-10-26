import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { useEffect, useState, useCallback } from "react";
import { Moon, Sun } from "./icons";
import Tooltip from "@/components/Common/Tooltip";
import { useThemeMode } from "@/hooks/use-theme-mode";

type ThemeMode = 'light' | 'dark';

const THEMES = [
  { name: "light", Icon: Sun },
  { name: "dark", Icon: Moon },
] as const;

export function ThemeToggleSwitch() {
  const { setTheme, theme, resolvedTheme } = useTheme();
  const { updateMode } = useThemeMode();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentMode = theme === "system" ? resolvedTheme : theme;
  const isDarkMode = currentMode === "dark";

  const handleToggle = useCallback(() => {
    const nextMode: ThemeMode = isDarkMode ? "light" : "dark";

    // Immediate UI update via next-themes
    setTheme(nextMode);

    // Background API persistence
    // We don't wait for this to finish to update UI, ensuring responsiveness
    updateMode(nextMode, true).catch((error) => {
      console.error('Failed to persist theme mode:', error);
      // Optional: Revert on failure? 
      // Usually better not to jump back unless critical.
      // setTheme(isDarkMode ? "dark" : "light"); 
    });
  }, [isDarkMode, setTheme, updateMode]);

  const tooltipLabel = isDarkMode
    ? "Chuyển sang giao diện sáng"
    : "Chuyển sang giao diện tối";

  if (!mounted) {
    return null;
  }

  return (
    <Tooltip label={tooltipLabel}>
      <button
        onClick={handleToggle}
        className="group rounded-full bg-gray-3 p-1 text-[#111928] outline-1 outline-primary focus-visible:outline dark:bg-[#020D1A] dark:text-current sm:p-[5px]"
        aria-label={tooltipLabel}
      >
        <span className="sr-only">
          Switch to {currentMode === "light" ? "dark" : "light"} mode
        </span>

        <span aria-hidden className="relative flex gap-1.5 sm:gap-2.5">
          {/* Indicator */}
          <span className="absolute size-8 rounded-full border border-gray-200 bg-white transition-all dark:translate-x-[36px] dark:border-none dark:bg-dark-2 dark:group-hover:bg-dark-3 sm:size-[38px] sm:dark:translate-x-[48px]" />

          {THEMES.map(({ name, Icon }) => (
            <span
              key={name}
              className={cn(
                "relative grid size-8 place-items-center rounded-full sm:size-[38px]",
                name === "dark" && "dark:text-white",
              )}
            >
              <Icon />
            </span>
          ))}
        </span>
      </button>
    </Tooltip>
  );
}
