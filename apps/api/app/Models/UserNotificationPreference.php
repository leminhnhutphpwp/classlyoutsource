<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserNotificationPreference extends Model
{
    use \App\Traits\HasHashId, HasFactory;

    protected $fillable = [
        'user_id',
        'notification_type',
        'channels',
        'is_enabled',
    ];

    protected function casts(): array
    {
        return [
            'channels' => 'array',
            'is_enabled' => 'boolean',
        ];
    }

    /**
     * Get the user that owns this preference.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get channels with default value.
     */
    public function getChannels(): array
    {
        $channels = $this->attributes['channels'] ?? null;

        if ($channels === null || $channels === '') {
            return ['email'];
        }

        // If already array (from cast), return it
        if (is_array($channels)) {
            return empty($channels) ? ['email'] : $channels;
        }

        // If JSON string, decode it
        if (is_string($channels)) {
            $decoded = json_decode($channels, true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                return empty($decoded) ? ['email'] : $decoded;
            }
        }

        return ['email'];
    }

    /**
     * Check if notification should be sent via a specific channel.
     */
    public function shouldSendVia(string $channel): bool
    {
        if (! $this->is_enabled) {
            return false;
        }

        $channels = $this->getChannels();

        return in_array($channel, $channels);
    }

    /**
     * Get user preference for a notification type, or return default.
     */
    public static function getPreference(int $userId, string $notificationType): ?self
    {
        return self::where('user_id', $userId)
            ->where('notification_type', $notificationType)
            ->first();
    }

    /**
     * Get or create preference with default values.
     */
    public static function getOrCreatePreference(int $userId, string $notificationType, array $defaultChannels = ['email']): self
    {
        return self::firstOrCreate(
            [
                'user_id' => $userId,
                'notification_type' => $notificationType,
            ],
            [
                'channels' => $defaultChannels,
                'is_enabled' => true,
            ]
        );
    }

    /**
     * Check if user wants to receive notification of a specific type.
     */
    public static function shouldSendNotification(int $userId, string $notificationType, string $channel = 'email'): bool
    {
        $preference = self::getPreference($userId, $notificationType);

        // If no preference exists, default to enabled with email
        if (! $preference) {
            return true; // Default: send notification
        }

        return $preference->shouldSendVia($channel);
    }
}
