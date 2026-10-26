<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PasswordResetCode extends Model
{
    use HasFactory;

    /**
     * Maximum number of wrong guesses allowed against a single code before it
     * is invalidated. Bounds brute-force per account regardless of source IP.
     */
    public const MAX_ATTEMPTS = 5;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'email',
        'code',
        'expires_at',
        'used',
        'used_at',
        'attempts',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'expires_at' => 'datetime',
        'used_at' => 'datetime',
        'used' => 'boolean',
        'attempts' => 'integer',
    ];

    /**
     * Generate a 6-digit verification code.
     */
    public static function generateCode(): string
    {
        return str_pad(random_int(100000, 999999), 6, '0', STR_PAD_LEFT);
    }

    /**
     * Create a new password reset code for email.
     */
    public static function createForEmail(string $email): self
    {
        // Delete any existing unused codes for this email
        static::where('email', $email)
            ->where('used', false)
            ->where('expires_at', '>', now())
            ->delete();

        // Create new code
        return static::create([
            'email' => $email,
            'code' => static::generateCode(),
            'expires_at' => now()->addMinutes(15), // 15 minutes expiry
        ]);
    }

    /**
     * Verify a code for email.
     *
     * On a wrong guess against an otherwise-valid active code, the per-code
     * attempt counter is incremented; once it reaches MAX_ATTEMPTS the code is
     * deleted so further guesses fail closed and the user must request a new one.
     * Returns the matching code on success, or null on any failure.
     */
    public static function verifyCode(string $email, string $code): ?self
    {
        // Find the active (unused, unexpired) code for this email, newest first.
        $active = static::where('email', $email)
            ->where('used', false)
            ->where('expires_at', '>', now())
            ->orderByDesc('id')
            ->first();

        if (! $active) {
            return null;
        }

        if (hash_equals($active->code, $code)) {
            return $active;
        }

        // Wrong code: burn one attempt; invalidate the code once the cap is hit.
        $active->increment('attempts');

        if ($active->attempts >= self::MAX_ATTEMPTS) {
            $active->delete();
        }

        return null;
    }

    /**
     * Mark code as used.
     */
    public function markAsUsed(): void
    {
        $this->update([
            'used' => true,
            'used_at' => now(),
        ]);
    }

    /**
     * Check if code is expired.
     */
    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    /**
     * Check if code is valid (not used and not expired).
     */
    public function isValid(): bool
    {
        return ! $this->used && ! $this->isExpired();
    }

    /**
     * Get remaining time in minutes.
     */
    public function getRemainingMinutes(): int
    {
        return max(0, now()->diffInMinutes($this->expires_at, false));
    }

    /**
     * Scope to get only valid codes.
     */
    public function scopeValid($query)
    {
        return $query->where('used', false)
            ->where('expires_at', '>', now());
    }

    /**
     * Scope to get codes for specific email.
     */
    public function scopeForEmail($query, string $email)
    {
        return $query->where('email', $email);
    }

    /**
     * Clean up expired codes (can be called from scheduler).
     */
    public static function cleanupExpired(): int
    {
        return static::where('expires_at', '<', now())
            ->orWhere('used', true)
            ->delete();
    }
}
