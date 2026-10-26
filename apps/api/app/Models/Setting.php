<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;

class Setting extends Model
{
    use HasFactory;

    /**
     * Group payloads are cached (see getByGroup) — invalidate on ANY Eloquent write path
     * (create / update / save / delete), not just the set()/remove() helpers, so direct
     * writes like Setting::create() can never leave a stale group behind.
     */
    protected static function booted(): void
    {
        static::saved(function (self $setting) {
            static::forgetGroupCache((string) $setting->group);
            if ($setting->wasChanged('group')) {
                static::forgetGroupCache((string) $setting->getOriginal('group'));
            }
        });

        static::deleted(function (self $setting) {
            static::forgetGroupCache((string) $setting->group);
        });
    }

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'key',
        'value',
        'type',
        'group',
        'description',
        'is_public',
        'is_encrypted',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_public' => 'boolean',
            'is_encrypted' => 'boolean',
        ];
    }

    /**
     * Get the value with decryption if needed.
     */
    public function getValueAttribute($value)
    {
        if ($this->is_encrypted && $value) {
            try {
                return Crypt::decryptString($value);
            } catch (\Exception $e) {
                return $value;
            }
        }

        // Cast based on type
        return $this->castValue($value);
    }

    /**
     * Set the value with encryption if needed.
     */
    public function setValueAttribute($value)
    {
        // Convert array/json to string before saving
        if (is_array($value) || (is_object($value) && method_exists($value, '__toString'))) {
            $value = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }

        if ($this->is_encrypted && $value) {
            $this->attributes['value'] = Crypt::encryptString($value);
        } else {
            $this->attributes['value'] = $value;
        }
    }

    /**
     * Cast value based on type.
     */
    protected function castValue($value)
    {
        if ($value === null) {
            return null;
        }

        return match ($this->type) {
            'boolean' => filter_var($value, FILTER_VALIDATE_BOOLEAN),
            'integer' => (int) $value,
            'float' => (float) $value,
            'array', 'json' => json_decode($value, true),
            default => $value,
        };
    }

    /**
     * Get setting by key.
     *
     * @param  string  $key  Setting key
     * @param  mixed  $default  Default value if not found
     * @return mixed
     */
    public static function get(string $key, $default = null)
    {
        $setting = static::where('key', $key)->first();

        return $setting ? $setting->value : $default;
    }

    /**
     * Set setting by key.
     *
     * @param  string  $key  Setting key
     * @param  mixed  $value  Setting value
     * @param  array  $options  Additional options (type, group, description, etc.)
     */
    public static function set(string $key, $value, array $options = []): self
    {
        // Convert array to JSON if type is array
        $dbValue = $value;
        $type = $options['type'] ?? (is_array($value) ? 'array' : 'string');

        if ($type === 'array' && is_array($value)) {
            $dbValue = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }

        $setting = static::updateOrCreate(
            ['key' => $key],
            array_merge(['value' => $dbValue], $options)
        );

        // The group payload is cached for serialization hot paths — drop it so the
        // next read sees this write immediately (same request or a later one).
        static::forgetGroupCache($setting->group);
        if ($setting->wasChanged('group')) {
            static::forgetGroupCache((string) $setting->getOriginal('group'));
        }

        return $setting;
    }

    /**
     * Check if setting exists.
     */
    public static function has(string $key): bool
    {
        return static::where('key', $key)->exists();
    }

    /**
     * Delete setting by key.
     */
    public static function remove(string $key): bool
    {
        $group = static::where('key', $key)->value('group');

        $deleted = static::where('key', $key)->delete();

        // Bulk deletes don't fire model events — flush explicitly.
        if ($group) {
            static::forgetGroupCache((string) $group);
        }

        return $deleted;
    }

    /**
     * Get all settings as array.
     */
    public static function getAll(): array
    {
        return static::all()
            ->pluck('value', 'key')
            ->toArray();
    }

    /**
     * Get all settings by group.
     *
     * Cached per group (short TTL) — this is called for every pending payment row during
     * serialization (bank_transfer_info), so a page of payments would otherwise repeat
     * the same query per row. Cache::forget in set()/remove() keeps reads fresh.
     */
    public static function getByGroup(string $group): array
    {
        $key = static::groupCacheKey($group);

        return Cache::remember($key, now()->addMinutes(5), function () use ($group) {
            return static::where('group', $group)
                ->get()
                ->pluck('value', 'key')
                ->toArray();
        });
    }

    /** Cache key for a group payload. */
    protected static function groupCacheKey(string $group): string
    {
        return "settings:group:{$group}";
    }

    /** Drop the cached payload of one group (call after mutating that group). */
    public static function forgetGroupCache(string $group): void
    {
        Cache::forget(static::groupCacheKey($group));
    }

    /** Drop the cached payload of every known group (used when the writer may change groups). */
    public static function flushGroupCache(): void
    {
        $groups = static::query()->select('group')->distinct()->pluck('group');

        foreach ($groups as $group) {
            static::forgetGroupCache((string) $group);
        }
    }

    /**
     * Scope a query to only include settings of a specific group.
     */
    public function scopeOfGroup($query, $group)
    {
        return $query->where('group', $group);
    }

    /**
     * Scope a query to only include public settings.
     */
    public function scopePublic($query)
    {
        return $query->where('is_public', true);
    }
}
