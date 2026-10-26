import { getObjId } from "@/lib/id-utils";

/**
 * Format schedule recurring info into a human-readable string
 */
export function formatSchedule(schedule: any): string {
    if (!schedule) return 'N/A';

    const { recurring_type, recurring_days, day_name, time_range, start_time, end_time } = schedule;
    const time = time_range || (start_time && end_time ? `${start_time} - ${end_time}` : '');

    if (recurring_type === 'daily') {
        return `Hàng ngày ${time ? `(${time})` : ''}`;
    }

    if (recurring_type === 'weekly' && Array.isArray(recurring_days)) {
        const dayNames = recurring_days
            .sort((a: number, b: number) => a - b)
            .map((day: number) => {
                if (day === 7) return 'Chủ nhật';
                return `Thứ ${day + 1}`;
            })
            .join(', ');
        return `${dayNames} ${time ? `(${time})` : ''}`;
    }

    if (recurring_type === 'single' || recurring_type === 'once') {
        return `${day_name || 'Một lần'} ${time ? `(${time})` : ''}`;
    }

    if (day_name) {
        return `${day_name} ${time ? `(${time})` : ''}`;
    }

    return schedule.name || schedule.title || `Lịch #${getObjId(schedule) || 'N/A'}`;
}
