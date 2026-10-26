import { useState, useEffect, useRef } from "react";

/**
 * Hook to generate a fake progress value (0-90%) when loading is true.
 * Useful for providing visual feedback during uncertain wait times (like file uploads using fetch).
 * @param isLoading Whether the process is currently running
 * @param speed Adjustment for speed (default 200ms per text)
 */
export function useFakeProgress(isLoading: boolean, speed: number = 200) {
    const [progress, setProgress] = useState<number | null>(null);
    const progressRef = useRef<number | null>(null);

    // Keep a ref in sync with `progress` so the completion effect below can read
    // the latest value without depending on `progress` itself (adding it to the
    // deps would restart the interval and reset progress to 0 on every tick).
    useEffect(() => {
        progressRef.current = progress;
    });

    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (isLoading) {
            setProgress(0);
            interval = setInterval(() => {
                setProgress((prev) => {
                    if (prev === null) return 0;
                    if (prev >= 90) return 90; // Stall at 90%
                    // Slow down as it gets higher to simulate "almost done"
                    const increment = prev < 50 ? 5 : prev < 80 ? 2 : 0.5;
                    return prev + increment;
                });
            }, speed);
        } else {
            if (progressRef.current !== null) {
                // Complete the progress bar
                setProgress(100);
                // Reset after a short delay
                const timeout = setTimeout(() => setProgress(null), 500);
                return () => clearTimeout(timeout);
            }
        }

        return () => clearInterval(interval);
    }, [isLoading, speed]);

    return progress;
}
