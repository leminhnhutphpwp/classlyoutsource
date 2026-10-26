"use client";

import { useEffect } from "react";

/**
 * VersionChecker handles automatic browser cache clearing and page refresh
 * when a new version of the application is deployed.
 *
 * It compares the version from NEXT_PUBLIC_APP_VERSION with the one stored in localStorage.
 */
export default function VersionChecker() {
    useEffect(() => {
        // Only run in production-like environments or if you want to test in development
        const currentVersion = process.env.NEXT_PUBLIC_APP_VERSION;

        if (!currentVersion) {
            console.warn("VersionChecker: NEXT_PUBLIC_APP_VERSION is not defined.");
            return;
        }

        const savedVersion = localStorage.getItem("app_version");

        // If there is no saved version, this is likely the first visit since integration
        if (!savedVersion) {
            localStorage.setItem("app_version", currentVersion);
            return;
        }

        // Compare versions
        if (savedVersion !== currentVersion) {
            // Update the version first to avoid infinite reload loop
            localStorage.setItem("app_version", currentVersion);

            // List of specific localStorage keys you might want to PERSIST (like auth tokens)
            // If you want to keep logs, tokens, etc., DON'T call localStorage.clear()
            // Instead, just force a hard reload of the page.
            // Browser will fetch the new entry point (index.html) which has new hashed JS links.

            // Optional: Delay slightly to let the user see a message or just reload immediately
            setTimeout(() => {
                // window.location.reload(true) is deprecated in some browsers, window.location.reload() is usually enough
                // but adding a timestamp query param can force server bypass in some cases
                const url = new URL(window.location.href);
                url.searchParams.set("v", currentVersion);
                window.location.href = url.toString();
            }, 500);
        }
    }, []);

    return null;
}
