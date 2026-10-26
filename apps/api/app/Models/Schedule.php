<?php

namespace App\Models;

use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Schedule extends Model
{
    use \App\Traits\HasHashId, HasFactory, SoftDeletes;

    protected $fillable = [
        'class_id',
        'day_of_week',
        'start_time',
        'end_time',
        'room',
        'location',
        'notes',
        'is_active',
        'recurring_type',
        'recurring_days',
        'start_date',
        'end_date',
        'default_mode',
        'online_platform',
        'online_meeting_url',
        'online_meeting_id',
        'online_meeting_password',
        'online_config',
        'is_alternating',
        'alternating_pattern',
    ];

    protected function casts(): array
    {
        return [
            'start_time' => 'datetime:H:i',
            'end_time' => 'datetime:H:i',
            'is_active' => 'boolean',
            'recurring_days' => 'array',
            'start_date' => 'date',
            'end_date' => 'date',
            'online_config' => 'array',
            'is_alternating' => 'boolean',
            'alternating_pattern' => 'array',
        ];
    }

    /**
     * Get the class that owns the schedule.
     */
    public function class(): BelongsTo
    {
        return $this->belongsTo(ClassRoom::class, 'class_id');
    }

    /**
     * Get all generated sessions for this schedule.
     */
    public function sessions(): HasMany
    {
        return $this->hasMany(ScheduleSession::class);
    }

    /**
     * Get day name in Vietnamese.
     */
    public function getDayNameAttribute(): ?string
    {
        return match ($this->day_of_week) {
            'monday' => 'Thứ 2',
            'tuesday' => 'Thứ 3',
            'wednesday' => 'Thứ 4',
            'thursday' => 'Thứ 5',
            'friday' => 'Thứ 6',
            'saturday' => 'Thứ 7',
            'sunday' => 'Chủ nhật',
            default => $this->day_of_week,
        };
    }

    /**
     * Get formatted time range.
     */
    public function getTimeRangeAttribute(): string
    {
        return $this->start_time->format('H:i').' - '.$this->end_time->format('H:i');
    }

    /**
     * Get duration in minutes.
     */
    public function getDurationAttribute(): int
    {
        return $this->start_time->diffInMinutes($this->end_time);
    }

    /**
     * Check if schedule is active (enabled).
     */
    public function isActive(): bool
    {
        return $this->is_active;
    }

    /**
     * Check if schedule has started.
     */
    public function hasStarted(): bool
    {
        if (! $this->start_date) {
            return false;
        }

        return Carbon::parse($this->start_date)->isPast() || Carbon::parse($this->start_date)->isToday();
    }

    /**
     * Check if schedule has ended (completed).
     */
    public function hasEnded(): bool
    {
        if (! $this->end_date) {
            return false;
        }

        return Carbon::parse($this->end_date)->isPast();
    }

    /**
     * Check if schedule is currently in progress.
     */
    public function isInProgress(): bool
    {
        return $this->is_active && $this->hasStarted() && ! $this->hasEnded();
    }

    /**
     * Check if schedule is upcoming (not started yet).
     */
    public function isUpcoming(): bool
    {
        if (! $this->start_date) {
            return false;
        }

        return Carbon::parse($this->start_date)->isFuture();
    }

    /**
     * Check if schedule is completed (ended).
     */
    public function isCompleted(): bool
    {
        return $this->hasEnded();
    }

    /**
     * Check if schedule is paused (inactive but not ended).
     */
    public function isPaused(): bool
    {
        return ! $this->is_active && $this->hasStarted() && ! $this->hasEnded();
    }

    /**
     * Get schedule status.
     *
     * @return string 'upcoming'|'in_progress'|'completed'|'paused'
     */
    public function getStatusAttribute(): string
    {
        if ($this->isCompleted()) {
            return 'completed';
        }

        if ($this->isPaused()) {
            return 'paused';
        }

        if ($this->isInProgress()) {
            return 'in_progress';
        }

        if ($this->isUpcoming()) {
            return 'upcoming';
        }

        return 'unknown';
    }

    /**
     * Get status label in Vietnamese.
     */
    public function getStatusLabelAttribute(): string
    {
        return match ($this->status) {
            'upcoming' => 'Sắp bắt đầu',
            'in_progress' => 'Đang diễn ra',
            'completed' => 'Đã hoàn thành',
            'paused' => 'Tạm dừng',
            default => 'Không xác định',
        };
    }

    /**
     * Get status color for UI.
     */
    public function getStatusColorAttribute(): string
    {
        return match ($this->status) {
            'upcoming' => 'info',
            'in_progress' => 'success',
            'completed' => 'gray',
            'paused' => 'warning',
            default => 'gray',
        };
    }

    /**
     * Check if schedule is today.
     */
    public function isToday(): bool
    {
        $today = strtolower(now()->englishDayOfWeek);

        return $this->day_of_week === $today;
    }

    /**
     * Generate sessions for this schedule based on recurring pattern.
     *
     * @return int Number of sessions generated
     */
    public function generateSessions(): int
    {
        if (! $this->start_date || ! $this->end_date) {
            return 0;
        }

        $generatedCount = 0;
        $period = CarbonPeriod::create($this->start_date, $this->end_date);

        // Get class start/end dates as boundaries
        $classStartDate = $this->class->start_date ? Carbon::parse($this->class->start_date) : null;
        $classEndDate = $this->class->end_date ? Carbon::parse($this->class->end_date) : null;

        // Calculate weekNumber based on learning weeks (from start_date, every 7 days = 1 week)
        // NOT calendar weeks (Monday-Sunday), to match API grouping logic
        $scheduleStartDate = Carbon::parse($this->start_date)->startOfDay();

        foreach ($period as $date) {
            // Calculate learning week number (from schedule start_date, every 7 days = 1 week)
            $daysFromStart = $scheduleStartDate->diffInDays($date);
            $weekNumber = floor($daysFromStart / 7) + 1;

            // Check if this day matches our recurring pattern
            if ($this->shouldHaveSessionOnDate($date, $weekNumber)) {
                // Check if session already exists (including soft deleted)
                // Use direct query to check unique constraint: schedule_id + session_date
                $existingSession = ScheduleSession::withTrashed()
                    ->where('schedule_id', $this->id)
                    ->where('session_date', $date->format('Y-m-d'))
                    ->first();

                if ($existingSession) {
                    // Skip if session exists and is completed/cancelled (these are preserved)
                    if (in_array($existingSession->status, ['completed', 'cancelled']) && ! $existingSession->trashed()) {
                        continue;
                    }

                    // Session exists - update it instead of creating duplicate
                    // This handles both soft deleted and existing sessions
                    if ($existingSession->trashed()) {
                        $existingSession->restore();
                    }

                    // Update with latest schedule values
                    $mode = $this->getModeForWeek($weekNumber);
                    $updateData = [
                        'start_time' => $this->start_time,
                        'end_time' => $this->end_time,
                        'mode' => $mode,
                        'week_number' => $weekNumber,
                    ];

                    // Only update status if it's not a completed/cancelled session
                    if (! in_array($existingSession->status, ['completed', 'cancelled'])) {
                        $updateData['status'] = 'scheduled';
                    }

                    // Update offline details
                    if ($mode === 'offline') {
                        $updateData['room'] = $this->room;
                        $updateData['location'] = $this->location;
                    }

                    // Update online details
                    if ($mode === 'online') {
                        $updateData['online_platform'] = $this->online_platform;
                        $updateData['online_meeting_url'] = $this->online_meeting_url;
                        $updateData['online_meeting_id'] = $this->online_meeting_id;
                        $updateData['online_meeting_password'] = $this->online_meeting_password;
                        $updateData['online_config'] = $this->online_config;
                    }

                    $updateData['notes'] = $this->notes;
                    $existingSession->update($updateData);
                    $generatedCount++;

                    continue; // Skip creating new session
                }

                // Determine mode for this session
                $mode = $this->getModeForWeek($weekNumber);

                // Create session
                $sessionData = [
                    'schedule_id' => $this->id,
                    'class_id' => $this->class_id,
                    'session_date' => $date->format('Y-m-d'),
                    'start_time' => $this->start_time,
                    'end_time' => $this->end_time,
                    'mode' => $mode,
                    'week_number' => $weekNumber,
                    'status' => 'scheduled',
                ];

                // Add offline details
                if ($mode === 'offline') {
                    $sessionData['room'] = $this->room;
                    $sessionData['location'] = $this->location;
                }

                // Add online details
                if ($mode === 'online') {
                    $sessionData['online_platform'] = $this->online_platform;
                    $sessionData['online_meeting_url'] = $this->online_meeting_url;
                    $sessionData['online_meeting_id'] = $this->online_meeting_id;
                    $sessionData['online_meeting_password'] = $this->online_meeting_password;
                    $sessionData['online_config'] = $this->online_config;
                }

                $sessionData['notes'] = $this->notes;

                ScheduleSession::create($sessionData);
                $generatedCount++;
            }
        }

        return $generatedCount;
    }

    /**
     * Check if a session should be created on this date.
     */
    protected function shouldHaveSessionOnDate(Carbon $date, int $weekNumber): bool
    {
        // Single schedule - check exact day_of_week
        if ($this->recurring_type === 'single') {
            return $date->englishDayOfWeek === ucfirst($this->day_of_week);
        }

        // Weekly - check recurring_days array
        if ($this->recurring_type === 'weekly' && $this->recurring_days) {
            // recurring_days is array of day numbers: [1,3,5] = Monday, Wednesday, Friday
            $dayOfWeek = $date->dayOfWeekIso; // 1 (Monday) to 7 (Sunday)

            return in_array($dayOfWeek, $this->recurring_days);
        }

        // Biweekly - every 2 weeks
        if ($this->recurring_type === 'biweekly') {
            if ($weekNumber % 2 !== 1) { // Only odd weeks
                return false;
            }

            return $this->recurring_days ? in_array($date->dayOfWeekIso, $this->recurring_days) : true;
        }

        // Default: check day_of_week
        return $date->englishDayOfWeek === ucfirst($this->day_of_week);
    }

    /**
     * Get mode (online/offline) for a specific week based on alternating pattern.
     */
    protected function getModeForWeek(int $weekNumber): string
    {
        if (! $this->is_alternating || ! $this->alternating_pattern) {
            return $this->default_mode;
        }

        // alternating_pattern format: [{"week":1,"mode":"offline"},{"week":2,"mode":"online"}]
        // Or simple pattern: repeat every N weeks

        foreach ($this->alternating_pattern as $pattern) {
            if (isset($pattern['week']) && $pattern['week'] == $weekNumber) {
                return $pattern['mode'] ?? $this->default_mode;
            }
        }

        // If pattern is cyclic (e.g., week 1 offline, week 2 online, repeat)
        $patternLength = count($this->alternating_pattern);
        if ($patternLength > 0) {
            $cycleIndex = ($weekNumber - 1) % $patternLength;
            $pattern = $this->alternating_pattern[$cycleIndex];

            return $pattern['mode'] ?? $this->default_mode;
        }

        return $this->default_mode;
    }

    /**
     * Delete all future sessions and regenerate.
     * Sessions with status 'completed' or 'cancelled' are preserved.
     */
    public function regenerateSessions(): int
    {
        // Force delete future sessions that can be regenerated
        // Keep completed and cancelled sessions as per business requirement
        ScheduleSession::withTrashed()
            ->where('schedule_id', $this->id)
            ->where('session_date', '>=', now()->startOfDay())
            ->whereIn('status', ['scheduled', 'ongoing', 'postponed'])
            ->forceDelete();

        // Generate new sessions
        return $this->generateSessions();
    }

    /**
     * Scope: Active schedules (enabled).
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope: Upcoming schedules (not started yet).
     */
    public function scopeUpcoming($query)
    {
        return $query->where('start_date', '>', now()->toDateString());
    }

    /**
     * Scope: In progress schedules.
     */
    public function scopeInProgress($query)
    {
        return $query->where('is_active', true)
            ->where('start_date', '<=', now()->toDateString())
            ->where(function ($q) {
                $q->whereNull('end_date')
                    ->orWhere('end_date', '>=', now()->toDateString());
            });
    }

    /**
     * Scope: Completed schedules (ended).
     */
    public function scopeCompleted($query)
    {
        return $query->whereNotNull('end_date')
            ->where('end_date', '<', now()->toDateString());
    }

    /**
     * Scope: Paused schedules (inactive but not ended).
     */
    public function scopePaused($query)
    {
        return $query->where('is_active', false)
            ->where('start_date', '<=', now()->toDateString())
            ->where(function ($q) {
                $q->whereNull('end_date')
                    ->orWhere('end_date', '>=', now()->toDateString());
            });
    }

    /**
     * Scope: For specific day.
     */
    public function scopeForDay($query, string $day)
    {
        return $query->where('day_of_week', $day);
    }

    /**
     * Scope: For specific class.
     */
    public function scopeForClass($query, int $classId)
    {
        return $query->where('class_id', $classId);
    }

    /**
     * Scope: Order by day and time.
     */
    public function scopeOrdered($query)
    {
        $dayOrder = [
            'monday' => 1,
            'tuesday' => 2,
            'wednesday' => 3,
            'thursday' => 4,
            'friday' => 5,
            'saturday' => 6,
            'sunday' => 7,
        ];

        return $query->orderByRaw(
            "CASE day_of_week 
                WHEN 'monday' THEN 1 
                WHEN 'tuesday' THEN 2 
                WHEN 'wednesday' THEN 3 
                WHEN 'thursday' THEN 4 
                WHEN 'friday' THEN 5 
                WHEN 'saturday' THEN 6 
                WHEN 'sunday' THEN 7 
            END"
        )->orderBy('start_time');
    }
}
