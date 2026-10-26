/**
 * Helper functions for student notes
 */

export interface BehaviorBadgeConfig {
    label: string;
    colorClasses: string;
}

/**
 * Get behavior badge configuration based on behavior type
 */
export function getBehaviorBadge(behavior: 'excellent' | 'good' | 'average' | 'poor', behaviorLabel?: string): BehaviorBadgeConfig {
    const label = behaviorLabel ||
        (behavior === 'excellent' ? 'Xuất sắc' :
            behavior === 'good' ? 'Tốt' :
                behavior === 'average' ? 'Trung bình' :
                    'Cần cải thiện');

    const colorClasses =
        behavior === 'excellent'
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
            : behavior === 'good'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                : behavior === 'average'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';

    return { label, colorClasses };
}

/**
 * Behavior Badge Component
 */
export function BehaviorBadge({
    behavior,
    behaviorLabel
}: {
    behavior: 'excellent' | 'good' | 'average' | 'poor';
    behaviorLabel?: string;
}) {
    const { label, colorClasses } = getBehaviorBadge(behavior, behaviorLabel);

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClasses}`}>
            {label}
        </span>
    );
}
