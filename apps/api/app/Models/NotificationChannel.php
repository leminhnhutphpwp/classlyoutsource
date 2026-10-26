<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;

class NotificationChannel extends Model
{
    use HasFactory;

    protected $fillable = [
        'channel',
        'is_enabled',
        'provider',
        'api_key',
        'api_secret',
        'config',
        'description',
    ];

    protected $casts = [
        'is_enabled' => 'boolean',
        'config' => 'array',
    ];

    /**
     * Encrypt API credentials when setting
     */
    public function setApiKeyAttribute($value)
    {
        $this->attributes['api_key'] = $value ? Crypt::encryptString($value) : null;
    }

    public function setApiSecretAttribute($value)
    {
        $this->attributes['api_secret'] = $value ? Crypt::encryptString($value) : null;
    }

    /**
     * Decrypt API credentials when getting
     */
    public function getApiKeyAttribute($value)
    {
        if (! $value) {
            return null;
        }

        try {
            return Crypt::decryptString($value);
        } catch (\Exception $e) {
            return $value;
        }
    }

    public function getApiSecretAttribute($value)
    {
        if (! $value) {
            return null;
        }

        try {
            return Crypt::decryptString($value);
        } catch (\Exception $e) {
            return $value;
        }
    }

    /**
     * Check if channel is available (enabled and configured)
     */
    public function isAvailable(): bool
    {
        return $this->is_enabled && $this->api_key !== null;
    }

    /**
     * Get enabled channels
     */
    public static function getEnabledChannels(): array
    {
        return static::where('is_enabled', true)
            ->pluck('channel')
            ->toArray();
    }

    /**
     * Get channel by name
     */
    public static function getByChannel(string $channel): ?self
    {
        return static::where('channel', $channel)->first();
    }
}
