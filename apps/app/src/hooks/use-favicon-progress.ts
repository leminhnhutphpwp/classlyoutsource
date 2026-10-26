import { useEffect, useRef } from "react";

/**
 * Hook to display a progress indicator on the browser tab's favicon.
 * Useful for displaying loading states, file uploads, etc.
 * @param percent Progress percentage (0-100).
 * @param options Customization options.
 */
export function useFaviconProgress(
    percent: number,
    options: {
        color?: string;
        showOnComplete?: boolean; // If true, keep showing 100% state
    } = {}
) {
    const originalHref = useRef<string | null>(null);
    const { color = "#EF4444", showOnComplete = false } = options;

    useEffect(() => {
        if (typeof window === "undefined") return;

        let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        if (!link) {
            link = document.createElement("link");
            link.rel = "icon";
            document.head.appendChild(link);
        }

        if (!originalHref.current) {
            originalHref.current = link.href;
        }

        // Clean up or revert logic
        // If progress is 0 or 100 (and we don't want to show on complete), revert to original
        if ((percent <= 0 || (percent >= 100 && !showOnComplete))) {
            if (originalHref.current) {
                link.href = originalHref.current;
            }
            return;
        }

        const canvas = document.createElement("canvas");
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext("2d");

        if (!ctx) return;

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = originalHref.current;

        img.onload = () => {
            ctx.clearRect(0, 0, 32, 32);

            // Config
            const centerX = 16;
            const centerY = 16;
            const radius = 14;
            const lineWidth = 3;

            // 1. Draw Original Icon (Scaled down slightly to fit inside ring)
            // Save canvas state
            ctx.save();
            // Enable clipping to circle
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius - lineWidth / 2 - 1, 0, 2 * Math.PI);
            ctx.clip();
            ctx.drawImage(img, 0, 0, 32, 32);
            ctx.restore();

            // 2. Draw Background Ring (Gray/Light)
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.strokeStyle = "rgba(200, 200, 200, 0.3)";
            ctx.lineWidth = lineWidth;
            ctx.stroke();

            // 3. Draw Progress Arc
            // Start from top (-90deg or -PI/2)
            const startAngle = -Math.PI / 2;
            const endAngle = startAngle + (2 * Math.PI * (percent / 100));

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, startAngle, endAngle, false);
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.lineCap = "round"; // Rounded ends for smoother look
            ctx.stroke();

            // Update Header
            link.href = canvas.toDataURL("image/png");
        };
    }, [percent, color, showOnComplete]);
}
