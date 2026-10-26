import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";

interface UseFaviconTimerProps {
    remainingSeconds: number | null;
    totalSeconds: number | null;
    isRunning: boolean;
}

export function useFaviconTimer({
    remainingSeconds,
    totalSeconds,
    isRunning,
}: UseFaviconTimerProps) {
    const { theme } = useTheme();
    // Store the original favicon href to restore it later
    const originalFavicon = useRef<string | null>(null);

    // State for blinking effect
    const [blinkOn, setBlinkOn] = useState(false);

    // Colors config
    const colors = {
        normal: "#3b82f6", // Blue-500
        warning: "#f97316", // Orange-500
        critical: "#ef4444", // Red-500
        bg: "#ffffff",
        darkBg: "#1f2937", // Gray-800
    };

    // Blinking interval effect
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isRunning && remainingSeconds !== null && remainingSeconds <= 60 && remainingSeconds > 0) {
            interval = setInterval(() => {
                setBlinkOn(prev => !prev);
            }, 500);
        } else {
            setBlinkOn(false);
        }
        return () => clearInterval(interval);
    }, [remainingSeconds, isRunning]);

    useEffect(() => {
        // Only run if we're in a browser environment
        if (typeof window === "undefined" || !isRunning || remainingSeconds === null || !totalSeconds) {
            if (originalFavicon.current) {
                changeFavicon(originalFavicon.current);
            }
            return;
        }

        const link = (document.querySelector("link[rel*='icon']") as HTMLLinkElement) || document.createElement("link");

        // Backup original favicon only once
        if (!originalFavicon.current) {
            originalFavicon.current = link.href;
        }

        // Create a temporary canvas to draw the timer
        const canvas = document.createElement("canvas");
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext("2d");

        if (ctx) {
            const centerX = 16;
            const centerY = 16;
            const radius = 14;

            // Determine color based on time remaining
            let color = colors.normal;
            if (remainingSeconds <= 60) color = colors.critical;
            else if (remainingSeconds <= 300) color = colors.warning;

            const isCritical = remainingSeconds <= 60 && remainingSeconds > 0;
            const showAlert = isCritical && blinkOn;

            // 1. Draw Background Circle
            ctx.beginPath();
            ctx.arc(centerX, centerY, 16, 0, 2 * Math.PI);
            if (showAlert) {
                ctx.fillStyle = colors.critical; // Flashing Red Background
            } else {
                ctx.fillStyle = theme === "dark" ? colors.darkBg : colors.bg;
            }
            ctx.fill();

            // 2. Draw Timer Pie Chart (Remaining Time)
            const percent = Math.max(0, Math.min(1, remainingSeconds / totalSeconds));
            const startAngle = -0.5 * Math.PI; // -90 degrees (12 o'clock)
            const endAngle = startAngle + (2 * Math.PI * percent);

            ctx.beginPath();
            ctx.moveTo(centerX, centerY); // Move to center
            ctx.arc(centerX, centerY, radius, startAngle, endAngle, false); // Draw arc
            ctx.lineTo(centerX, centerY); // Line back to center

            if (showAlert) {
                ctx.fillStyle = "#ffffff"; // Flashing White Pie
            } else {
                ctx.fillStyle = color;
            }
            ctx.fill();

            // Update favicon
            const newIcon = canvas.toDataURL("image/png");
            changeFavicon(newIcon);
        }
    }, [remainingSeconds, totalSeconds, isRunning, theme, blinkOn, colors.bg, colors.critical, colors.darkBg, colors.normal, colors.warning]);

    // Clean up on component unmount
    useEffect(() => {
        return () => {
            if (originalFavicon.current) {
                changeFavicon(originalFavicon.current);
            }
        };
    }, []);

    const changeFavicon = (src: string) => {
        const link = (document.querySelector("link[rel*='icon']") as HTMLLinkElement) || document.createElement("link");
        link.type = "image/x-icon";
        link.rel = "shortcut icon";
        link.href = src;
        document.getElementsByTagName("head")[0].appendChild(link);
    };
}
