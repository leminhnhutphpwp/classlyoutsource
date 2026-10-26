<?php

namespace App\Models;

use App\Traits\HasHashId;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class ScheduleSession extends Model
{
    use HasFactory, HasHashId, SoftDeletes;

    protected $fillable = [
        'schedule_id',
        'class_id',
        'session_date',
        'start_time',
        'end_time',
        'mode',
        'room',
        'location',
        'online_platform',
        'online_meeting_url',
        'online_meeting_id',
        'online_meeting_password',
        'online_config',
        'status',
        'attendance_code',
        'completed_at',
        'completed_by',
        'notes',
        'week_number',
    ];

    protected function casts(): array
    {
        return [
            'session_date' => 'date',
            'start_time' => 'datetime:H:i',
            'end_time' => 'datetime:H:i',
            'online_config' => 'array',
            'completed_at' => 'datetime',
        ];
    }

    /**
     * Get the schedule template.
     */
    public function schedule(): BelongsTo
    {
        return $this->belongsTo(Schedule::class);
    }

    /**
     * Get the class.
     */
    public function class(): BelongsTo
    {
        return $this->belongsTo(ClassRoom::class, 'class_id');
    }

    /**
     * Get the user who completed this session.
     */
    public function completedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'completed_by');
    }

    /**
     * Check if session is online.
     */
    public function isOnline(): bool
    {
        return $this->mode === 'online';
    }

    /**
     * Check if session is offline.
     */
    public function isOffline(): bool
    {
        return $this->mode === 'offline';
    }

    /**
     * Get formatted session date.
     */
    public function getFormattedDateAttribute(): string
    {
        return $this->session_date->format('d/m/Y');
    }

    /**
     * Get time range.
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
     * Get platform label.
     */
    public function getPlatformLabelAttribute(): ?string
    {
        if (! $this->isOnline()) {
            return null;
        }

        return match ($this->online_platform) {
            'zoom' => 'Zoom',
            'google_meet' => 'Google Meet',
            'microsoft_teams' => 'Microsoft Teams',
            'jitsi' => 'Jitsi Meet',
            'other' => 'Khác',
            default => null,
        };
    }

    /**
     * Get status label.
     */
    public function getStatusLabelAttribute(): string
    {
        return match ($this->status) {
            'scheduled' => 'Đã lên lịch',
            'ongoing' => 'Đang diễn ra',
            'completed' => 'Đã hoàn thành',
            'cancelled' => 'Đã hủy',
            'postponed' => 'Hoãn lại',
            default => $this->status,
        };
    }

    /**
     * Get status color.
     */
    public function getStatusColorAttribute(): string
    {
        return match ($this->status) {
            'scheduled' => 'info',
            'ongoing' => 'warning',
            'completed' => 'success',
            'cancelled' => 'danger',
            'postponed' => 'gray',
            default => 'gray',
        };
    }

    /**
     * Check if session is past.
     */
    public function isPast(): bool
    {
        return $this->session_date->isPast();
    }

    /**
     * Check if session is today.
     */
    public function isToday(): bool
    {
        return $this->session_date->isToday();
    }

    /**
     * Check if session is upcoming.
     */
    public function isUpcoming(): bool
    {
        return $this->session_date->isFuture();
    }

    /**
     * Scope: Filter by date range.
     */
    public function scopeDateRange($query, $startDate, $endDate)
    {
        return $query->whereBetween('session_date', [$startDate, $endDate]);
    }

    /**
     * Scope: Online sessions.
     */
    public function scopeOnline($query)
    {
        return $query->where('mode', 'online');
    }

    /**
     * Scope: Offline sessions.
     */
    public function scopeOffline($query)
    {
        return $query->where('mode', 'offline');
    }

    /**
     * Scope: By status.
     */
    public function scopeStatus($query, string $status)
    {
        return $query->where('status', $status);
    }

    /**
     * Scope: Upcoming sessions.
     */
    public function scopeUpcoming($query)
    {
        return $query->where('session_date', '>=', now()->startOfDay())
            ->where('status', '!=', 'cancelled')
            ->orderBy('session_date')
            ->orderBy('start_time');
    }

    /**
     * Scope: Past sessions.
     */
    public function scopePast($query)
    {
        return $query->where('session_date', '<', now()->startOfDay())
            ->orderBy('session_date', 'desc')
            ->orderBy('start_time', 'desc');
    }

    /**
     * Scope: Today's sessions.
     */
    public function scopeToday($query)
    {
        return $query->whereDate('session_date', now())
            ->orderBy('start_time');
    }

    /**
     * Check if session should be auto-completed based on time.
     * Auto-complete if session date + end_time has passed.
     */
    public function shouldBeAutoCompleted(): bool
    {
        if ($this->status === 'completed' || $this->status === 'cancelled') {
            return false;
        }

        $sessionEndDateTime = Carbon::parse($this->session_date->format('Y-m-d').' '.$this->end_time->format('H:i:s'));

        // Auto-complete if end time has passed (with 5 minutes buffer)
        return $sessionEndDateTime->addMinutes(5)->isPast();
    }

    /**
     * Auto-complete session if time has passed.
     * Returns true if status was changed, false otherwise.
     */
    public function autoCompleteIfNeeded(): bool
    {
        if ($this->shouldBeAutoCompleted()) {
            $this->update([
                'status' => 'completed',
                'completed_at' => now(),
                'attendance_code' => null, // retire the QR fallback code once the session is closed
                // completed_by remains null for auto-completed sessions
            ]);

            return true;
        }

        return false;
    }

    /**
     * Mark session as completed by a user.
     */
    public function markAsCompleted(?int $userId = null): void
    {
        $this->update([
            'status' => 'completed',
            'completed_at' => now(),
            'completed_by' => $userId ?? auth()->id(),
            'attendance_code' => null, // retire the QR fallback code once the session is closed
        ]);
    }

    /**
     * Check if session is completed.
     */
    public function isCompleted(): bool
    {
        return $this->status === 'completed';
    }

    /**
     * Check if session was manually completed (has completed_by).
     */
    public function isManuallyCompleted(): bool
    {
        return $this->isCompleted() && $this->completed_by !== null;
    }

    /**
     * Check if session was auto-completed (no completed_by).
     */
    public function isAutoCompleted(): bool
    {
        return $this->isCompleted() && $this->completed_by === null;
    }
}
