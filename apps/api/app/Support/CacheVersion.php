<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;

class CacheVersion
{
    /**
     * Get the current version for a resource/context.
     */
    public static function get(string $context, ?int $userId = null): string
    {
        $key = self::key($context, $userId);

        return (string) Cache::rememberForever($key, fn () => (string) microtime(true));
    }

    /**
     * Increment the version to effectively clear all caches using it.
     */
    public static function increment(string $context, ?int $userId = null): void
    {
        $key = self::key($context, $userId);
        Cache::forever($key, (string) microtime(true));
    }

    /**
     * Generate the version key.
     */
    private static function key(string $context, ?int $userId = null): string
    {
        return $userId ? "v:{$context}:u:{$userId}" : "v:{$context}";
    }
}
