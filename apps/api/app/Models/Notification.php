<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Notification extends Model
{
    use \App\Traits\HasHashId, HasFactory, SoftDeletes;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'title',
        'message',
        'type',
        'target',
        'recipient_type',
        'recipient_classes',
        'recipient_students',
        'recipient_ids',
        'channel',
        'status',
        'scheduled_at',
        'sent_at',
        'sent_count',
        'failed_count',
        'created_by',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'recipient_classes' => 'array',
            'recipient_students' => 'array',
            'recipient_ids' => 'array',
            'scheduled_at' => 'datetime',
            'sent_at' => 'datetime',
            'sent_count' => 'integer',
            'failed_count' => 'integer',
        ];
    }

    /**
     * User who created the notification.
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get all read records for this notification.
     */
    public function reads(): HasMany
    {
        return $this->hasMany(NotificationRead::class);
    }

    /**
     * Check if a specific user has read this notification.
     */
    public function isReadBy(?int $userId): bool
    {
        if (! $userId) {
            return false;
        }

        return $this->reads()->where('user_id', $userId)->exists();
    }

    /**
     * Get read status for a specific user.
     */
    public function getReadStatusFor(?int $userId): ?NotificationRead
    {
        if (! $userId) {
            return null;
        }

        return $this->reads()->where('user_id', $userId)->first();
    }

    /**
     * Recipients logs.
     */
    public function recipientLogs(): HasMany
    {
        return $this->hasMany(NotificationRecipientLog::class);
    }

    /**
     * Check if notification is sent.
     */
    public function isSent(): bool
    {
        return $this->status === 'sent';
    }

    /**
     * Check if notification is scheduled.
     */
    public function isScheduled(): bool
    {
        return $this->status === 'scheduled' && $this->scheduled_at && $this->scheduled_at->isFuture();
    }

    /**
     * Mark notification as sent.
     */
    public function markAsSent(int $sentCount = 0, int $failedCount = 0): bool
    {
        $this->status = 'sent';
        $this->sent_at = now();
        $this->sent_count = $sentCount;
        $this->failed_count = $failedCount;

        return $this->save();
    }

    /**
     * Scope a query to only include sent notifications.
     */
    public function scopeSent($query)
    {
        return $query->where('status', 'sent');
    }

    /**
     * Scope a query to only include draft notifications.
     */
    public function scopeDraft($query)
    {
        return $query->where('status', 'draft');
    }

    /**
     * Scope a query to only include scheduled notifications.
     */
    public function scopeScheduled($query)
    {
        return $query->where('status', 'scheduled');
    }

    /**
     * Scope a query to only include notifications of a specific type.
     */
    public function scopeOfType($query, $type)
    {
        return $query->where('type', $type);
    }
}
