import { useEffect, useRef } from "react";

/**
 * Hook to display a notification badge on the browser tab's favicon.
 * @param count Number of notifications to display. If 0, the badge is removed.
 */
export function useFaviconBadge(count: number) {
    const originalHref = useRef<string | null>(null);

    useEffect(() => {
        // Only run on client-side
        if (typeof window === "undefined") return;

        // 1. Find the existing favicon link element
        let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;

        // If no favicon exists, create one (unlikely but safe)
        if (!link) {
            link = document.createElement("link");
            link.rel = "icon";
            document.head.appendChild(link);
        }

        // 2. Backup the original favicon URL on first run
        if (!originalHref.current) {
            originalHref.current = link.href;
        }

        // 3. If count is 0, restore the original favicon and exit
        if (count <= 0) {
            if (originalHref.current) {
                link.href = originalHref.current;
            }
            return;
        }

        // 4. Create a canvas to draw the new favicon
        const canvas = document.createElement("canvas");
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext("2d");

        if (!ctx) return;

        // 5. Load the original favicon image
        const img = new Image();
        img.crossOrigin = "anonymous"; // Needed for CORS if icon is hosted elsewhere
        img.src = originalHref.current;

        img.onload = () => {
            // Clear canvas
            ctx.clearRect(0, 0, 32, 32);

            // Draw the original icon
            ctx.drawImage(img, 0, 0, 32, 32);

            // Badge Configuration
            const badgeX = 22;      // Position X (Right aligned)
            const badgeY = 10;      // Position Y (Top aligned)
            const r = 9;            // Radius

            // Draw Badge Background (Red Circle)
            ctx.beginPath();
            ctx.arc(badgeX, badgeY, r, 0, 2 * Math.PI);

            // Use Classly's Primary Red logic (#EF4444)
            ctx.fillStyle = "#EF4444";
            ctx.fill();

            // Draw Badge Border (White stroke for contrast)
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = "#FFFFFF";
            ctx.stroke();

            // Draw Badge Text (Count)
            ctx.font = "bold 12px 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
            ctx.fillStyle = "#FFFFFF";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            let countText = count.toString();
            if (count > 99) {
                countText = "99+";
                ctx.font = "bold 9px sans-serif"; // Smaller font for 3 digits
            }

            // Draw text (y + 1 to fix visual vertical alignment)
            ctx.fillText(countText, badgeX, badgeY + 1);

            // 6. Update the favicon link with the new data URL
            link.href = canvas.toDataURL("image/png");
        };

        // Fallback: If image fails to load (e.g. SVG without dimensions), draw badge directly?
        // For now, valid favicon is assumed.

    }, [count]);
}
