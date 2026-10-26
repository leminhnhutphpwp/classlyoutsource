<?php

namespace Tests\Feature\Caching;

use App\Support\SecuritySettings;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/**
 * Regression: SecuritySettings::clearAllCache() used Cache::flush(), nuking the ENTIRE shared cache
 * store on every settings save. It must now scope invalidation to security settings only.
 */
class SecuritySettingsCacheTest extends TestCase
{
    public function test_clear_all_cache_does_not_wipe_unrelated_cache(): void
    {
        Cache::put('some:unrelated:list', 'keep-me', 600);
        SecuritySettings::get('fraud.limits.classes.free.max'); // populate a security-settings cache entry

        SecuritySettings::clearAllCache();

        // Unrelated cache survives (no global flush):
        $this->assertSame('keep-me', Cache::get('some:unrelated:list'));
    }
}
