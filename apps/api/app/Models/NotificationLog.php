<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class NotificationLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'notification_type',
        'channel',
        'status',
        'recipient',
        'content',
        'error_message',
        'metadata',
        'cost',
        'sent_at',
        'delivered_at',
    ];

    protected $casts = [
        'metadata' => 'array',
        'cost' => 'decimal:2',
        'sent_at' => 'datetime',
        'delivered_at' => 'datetime',
    ];

    /**
     * Log a notification
     */
    public static function logNotification(
        string $notificationType,
        string $channel,
        string $recipient,
        ?string $content = null,
        string $status = 'pending'
    ): self {
        return static::create([
            'notification_type' => $notificationType,
            'channel' => $channel,
            'recipient' => $recipient,
            'content' => $content,
            'status' => $status,
        ]);
    }

    /**
     * Mark as sent
     */
    public function markAsSent(?array $metadata = null): void
    {
        $this->update([
            'status' => 'sent',
            'sent_at' => now(),
            'metadata' => $metadata,
        ]);
    }

    /**
     * Mark as failed
     */
    public function markAsFailed(string $errorMessage): void
    {
        $this->update([
            'status' => 'failed',
            'error_message' => $errorMessage,
        ]);
    }

    /**
     * Mark as delivered
     */
    public function markAsDelivered(): void
    {
        $this->update([
            'status' => 'delivered',
            'delivered_at' => now(),
        ]);
    }

    /**
     * Get total cost
     */
    public static function getTotalCost(?string $channel = null): float
    {
        $query = static::query();

        if ($channel) {
            $query->where('channel', $channel);
        }

        return (float) $query->sum('cost');
    }

    /**
     * Get monthly usage
     */
    public static function getMonthlyUsage(string $channel = 'sms'): int
    {
        return static::query()
            ->where('channel', $channel)
            ->whereMonth('created_at', now()->month)
            ->whereYear('created_at', now()->year)
            ->count();
    }

    /**
     * Scope for successful notifications
     */
    public function scopeSuccessful($query)
    {
        return $query->whereIn('status', ['sent', 'delivered']);
    }

    /**
     * Scope for failed notifications
     */
    public function scopeFailed($query)
    {
        return $query->where('status', 'failed');
    }
}
