<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserLock extends Model
{
    use \App\Traits\HasHashId, HasFactory;

    protected $fillable = [
        'user_id',
        'type',
        'status',
        'reason',
        'internal_note',
        'start_at',
        'end_at',
        'created_by',
        'unlocked_by',
        'unlocked_at',
        'notified_at',
        'metadata',
    ];

    protected $casts = [
        'start_at' => 'datetime',
        'end_at' => 'datetime',
        'unlocked_at' => 'datetime',
        'notified_at' => 'datetime',
        'metadata' => 'array',
    ];

    public const STATUS_SCHEDULED = 'scheduled';

    public const STATUS_ACTIVE = 'active';

    public const STATUS_DONE = 'done';

    public const STATUS_CANCELLED = 'cancelled';

    /**
     * User bị khóa.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Admin tạo lock.
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Admin mở khóa.
     */
    public function unlockedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'unlocked_by');
    }

    /**
     * Scope: chỉ lấy các lock còn hiệu lực (thời gian).
     */
    public function scopeWithinTimeWindow(Builder $query): Builder
    {
        $now = now();

        return $query
            ->where(function (Builder $q) use ($now) {
                $q->whereNull('start_at')
                    ->orWhere('start_at', '<=', $now);
            })
            ->where(function (Builder $q) use ($now) {
                $q->whereNull('end_at')
                    ->orWhere('end_at', '>', $now);
            });
    }

    /**
     * Scope: lock đang active (status = active hoặc scheduled + trong time window).
     * Bao gồm cả scheduled locks vì chúng đã được lên lịch và sẽ có hiệu lực.
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query
            ->whereIn('status', [self::STATUS_ACTIVE, self::STATUS_SCHEDULED])
            ->withinTimeWindow();
    }
}
