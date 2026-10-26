<?php

namespace App\Support;

use App\Models\Setting;
use Illuminate\Support\Facades\Cache;

/**
 * Helper để đọc security settings từ database với fallback về config.
 *
 * Settings được cache để tối ưu performance.
 * Auto-reload khi settings thay đổi.
 */
class SecuritySettings
{
    /**
     * Cache key prefix.
     */
    protected const CACHE_PREFIX = 'security_settings:';

    /**
     * Cache TTL (1 hour).
     */
    protected const CACHE_TTL = 3600;

    /**
     * Build a version-scoped cache key so clearAllCache() can invalidate every setting by bumping
     * one version counter — instead of Cache::flush() which nuked the ENTIRE shared store
     * (every list/detail/me cache) and caused an app-wide cold-start + stampede.
     */
    protected static function cacheKey(string $key): string
    {
        $version = CacheVersion::get('security_settings');

        return self::CACHE_PREFIX.'v:'.$version.':'.md5($key);
    }

    /**
     * Get setting value từ database hoặc config.
     *
     * @param  string  $key  Setting key (e.g., 'fraud.limits.classes.free.max')
     * @param  mixed  $default  Default value nếu không tìm thấy
     * @return mixed
     */
    public static function get(string $key, $default = null)
    {
        $cacheKey = self::cacheKey($key);

        return Cache::remember($cacheKey, self::CACHE_TTL, function () use ($key, $default) {
            // Try database first
            $dbValue = self::getFromDatabase($key);
            if ($dbValue !== null) {
                return $dbValue;
            }

            // Fallback to config
            return config($key, $default);
        });
    }

    /**
     * Get setting từ database.
     *
     * @param  string  $key  Setting key
     * @return mixed|null
     */
    protected static function getFromDatabase(string $key)
    {
        // Map config keys to database keys
        $dbKey = self::mapConfigKeyToDbKey($key);

        if (! $dbKey) {
            return null;
        }

        $setting = Setting::where('key', $dbKey)
            ->where('group', 'security')
            ->first();

        return $setting ? $setting->value : null;
    }

    /**
     * Map config key to database key.
     *
     * @param  string  $configKey  Config key (e.g., 'fraud.limits.classes.free.max')
     * @return string|null Database key (e.g., 'fraud_limits_classes_free_max')
     */
    protected static function mapConfigKeyToDbKey(string $configKey): ?string
    {
        // Remove 'fraud.' prefix
        $key = str_replace('fraud.', '', $configKey);

        // Replace dots with underscores
        $key = str_replace('.', '_', $key);

        return $key;
    }

    /**
     * Get nested config value.
     *
     * @param  string  $path  Dot-separated path (e.g., 'limits.classes.free.max')
     * @param  mixed  $default
     * @return mixed
     */
    public static function getNested(string $path, $default = null)
    {
        $fullKey = "fraud.{$path}";

        return self::get($fullKey, $default);
    }

    /**
     * Clear cache for a specific key.
     */
    public static function clearCache(string $key): void
    {
        Cache::forget(self::cacheKey($key));
    }

    /**
     * Clear ALL security settings cache by bumping the version — cheap and scoped, unlike the old
     * Cache::flush() which wiped the entire shared cache store (all list/detail/me caches) on every
     * settings save, causing an app-wide cache cold-start + stampede.
     */
    public static function clearAllCache(): void
    {
        CacheVersion::increment('security_settings');
    }

    /**
     * Get bot shield limit for a resource.
     *
     * @param  string  $resource  Resource type
     * @param  string  $window  Window type (per_minute, per_hour)
     * @param  mixed  $default
     * @return mixed
     */
    public static function getBotShieldLimit(string $resource, string $window, $default = null)
    {
        $path = "bot_shield.{$resource}.{$window}";

        return self::getNested($path, $default);
    }

    /**
     * Get session limit.
     *
     * @param  string  $setting  Setting name (max_active, max_idle_minutes, etc.)
     * @param  mixed  $default
     * @return mixed
     */
    public static function getSessionLimit(string $setting, $default = null)
    {
        $path = "sessions.{$setting}";

        return self::getNested($path, $default);
    }

    /**
     * Get invite rate limit.
     *
     * @param  string  $type  Limit type (per_user, per_user_daily, per_ip)
     * @param  string  $setting  Setting name (window_minutes, max)
     * @param  mixed  $default
     * @return mixed
     */
    public static function getInviteLimit(string $type, string $setting, $default = null)
    {
        $path = "invites.{$type}.{$setting}";

        return self::getNested($path, $default);
    }

    /**
     * Get rate limiting config.
     *
     * @param  string  $type  Rate limit type (api_authenticated, api_public, etc.)
     * @param  string  $setting  Setting name (max_attempts, decay_minutes)
     * @param  mixed  $default
     * @return mixed
     */
    public static function getRateLimit(string $type, string $setting, $default = null)
    {
        $path = "rate_limiting.{$type}.{$setting}";

        return self::getNested($path, $default);
    }

    /**
     * Get DDoS protection config.
     *
     * @param  string  $setting  Setting name (max_request_size, connection_timeout, etc.)
     * @param  mixed  $default
     * @return mixed
     */
    public static function getDdosProtection(string $setting, $default = null)
    {
        $path = "ddos_protection.{$setting}";

        return self::getNested($path, $default);
    }
}
