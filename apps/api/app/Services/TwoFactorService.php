<?php

namespace App\Services;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Str;
use PragmaRX\Google2FA\Google2FA;

/**
 * TOTP two-factor authentication helper.
 *
 * Responsibilities:
 *  - generate a shared secret + the otpauth:// provisioning URI (for the QR / manual entry),
 *  - verify a 6-digit TOTP code with a small clock-drift window,
 *  - generate / verify / consume single-use recovery codes,
 *  - mint and validate the short-lived, signed login CHALLENGE that binds the login
 *    step-1 (password OK) to step-2 (second factor) without ever leaking a JWT in between.
 *
 * Secrets and recovery codes never leave this layer in plaintext except the one-time
 * enable/confirm responses; on the User model they are stored via `encrypted` casts.
 */
class TwoFactorService
{
    /** Accept codes from the adjacent 30s windows (±1) to tolerate clock drift. */
    private const TOTP_WINDOW = 1;

    /** Recovery codes issued per (re)generation. */
    private const RECOVERY_CODE_COUNT = 8;

    /** Login challenge lifetime — long enough to type a code, short enough to limit replay. */
    private const CHALLENGE_TTL_MINUTES = 5;

    private const CHALLENGE_PURPOSE = '2fa_login';

    private Google2FA $engine;

    public function __construct(?Google2FA $engine = null)
    {
        $this->engine = $engine ?? new Google2FA;
    }

    /**
     * Generate a fresh base32 TOTP secret.
     */
    public function generateSecret(): string
    {
        return $this->engine->generateSecretKey();
    }

    /**
     * Build the otpauth:// provisioning URI (issuer = app name, account = user email).
     * This is what the authenticator app encodes as a QR; we also surface the raw secret
     * for manual entry.
     */
    public function provisioningUri(User $user, string $secret): string
    {
        $issuer = (string) config('app.name', 'Classly');

        return $this->engine->getQRCodeUrl($issuer, $user->email, $secret);
    }

    /**
     * Verify a TOTP code against a secret, tolerating a ±1 window of clock drift.
     */
    public function verifyCode(string $secret, string $code): bool
    {
        $code = trim($code);
        if ($secret === '' || $code === '') {
            return false;
        }

        try {
            return (bool) $this->engine->verifyKey($secret, $code, self::TOTP_WINDOW);
        } catch (\Throwable $e) {
            // Malformed secret/code — treat as a failed verification, never throw to the caller.
            return false;
        }
    }

    /**
     * Generate a fresh set of single-use recovery codes (plaintext — the caller stores them
     * via the model's `encrypted:array` cast and returns them to the user exactly once).
     *
     * @return array<int,string>
     */
    public function generateRecoveryCodes(): array
    {
        return collect(range(1, self::RECOVERY_CODE_COUNT))
            ->map(fn () => sprintf('%s-%s', Str::upper(Str::random(5)), Str::upper(Str::random(5))))
            ->all();
    }

    /**
     * If $code matches one of the user's stored recovery codes, consume it (remove it so it
     * can never be reused) and persist the shortened list. Returns true on a successful match.
     */
    public function consumeRecoveryCode(User $user, string $code): bool
    {
        $code = trim($code);
        if ($code === '') {
            return false;
        }

        $codes = $user->two_factor_recovery_codes ?? [];
        if (! is_array($codes) || empty($codes)) {
            return false;
        }

        $matched = false;
        $remaining = [];
        foreach ($codes as $stored) {
            // Constant-time compare; keep every non-matching code (only the first match is burned).
            if (! $matched && is_string($stored) && hash_equals($stored, $code)) {
                $matched = true;

                continue;
            }
            $remaining[] = $stored;
        }

        if ($matched) {
            $user->two_factor_recovery_codes = $remaining;
            $user->save();
        }

        return $matched;
    }

    /**
     * Verify a second factor for the given user: a TOTP code first, then fall back to a
     * single-use recovery code (which is consumed on success). Central to /auth/2fa/verify,
     * disable and recovery-code regeneration.
     */
    public function verifySecondFactor(User $user, string $code): bool
    {
        $secret = $user->two_factor_secret;

        if (is_string($secret) && $secret !== '' && $this->verifyCode($secret, $code)) {
            return true;
        }

        return $this->consumeRecoveryCode($user, $code);
    }

    /**
     * Mint a short-lived, signed + encrypted challenge that proves "password step passed for
     * user X at time T". It carries no JWT, is bound to the user id AND a fingerprint of their
     * current password hash (so a password change invalidates outstanding challenges), and
     * expires after CHALLENGE_TTL_MINUTES.
     */
    public function issueLoginChallenge(User $user): string
    {
        $payload = [
            'user_id' => $user->id,
            'purpose' => self::CHALLENGE_PURPOSE,
            'pwd' => $this->passwordFingerprint($user),
            'issued_at' => Carbon::now()->timestamp,
            'expires_at' => Carbon::now()->addMinutes(self::CHALLENGE_TTL_MINUTES)->timestamp,
        ];

        $payload['signature'] = $this->signChallenge($payload);

        return Crypt::encrypt(json_encode($payload));
    }

    /**
     * Validate a login challenge and return the bound User, or null if it is invalid, tampered,
     * expired, for the wrong purpose, or the user's password has since changed.
     */
    public function resolveLoginChallenge(string $challenge): ?User
    {
        try {
            $payload = json_decode(Crypt::decrypt($challenge), true);
        } catch (\Throwable $e) {
            return null;
        }

        if (! is_array($payload) || ! isset($payload['signature'], $payload['user_id'], $payload['purpose'])) {
            return null;
        }

        if ($payload['purpose'] !== self::CHALLENGE_PURPOSE) {
            return null;
        }

        $signature = $payload['signature'];
        unset($payload['signature']);

        if (! hash_equals($this->signChallenge($payload), (string) $signature)) {
            return null;
        }

        if (! isset($payload['expires_at']) || Carbon::createFromTimestamp($payload['expires_at'])->isPast()) {
            return null;
        }

        $user = User::find($payload['user_id']);
        if (! $user) {
            return null;
        }

        // Bind to the password at issue-time: a password change (or reset) kills the challenge.
        if (! hash_equals($this->passwordFingerprint($user), (string) ($payload['pwd'] ?? ''))) {
            return null;
        }

        return $user;
    }

    private function passwordFingerprint(User $user): string
    {
        return hash_hmac('sha256', (string) $user->password, (string) config('app.key'));
    }

    private function signChallenge(array $payload): string
    {
        $data = implode('|', [
            $payload['user_id'] ?? '',
            $payload['purpose'] ?? '',
            $payload['pwd'] ?? '',
            $payload['issued_at'] ?? '',
            $payload['expires_at'] ?? '',
        ]);

        return hash_hmac('sha256', $data, (string) config('app.key'));
    }
}
