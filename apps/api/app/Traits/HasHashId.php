<?php

namespace App\Traits;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Vinkla\Hashids\Facades\Hashids;

trait HasHashId
{
    /**
     * Get the hash ID for the model.
     */
    protected function hashId(): Attribute
    {
        return Attribute::make(
            get: fn () => Hashids::connection($this->getHashidsConnection())->encode($this->getKey()),
        );
    }

    /**
     * Get the hashids connection name.
     */
    public function getHashidsConnection(): string
    {
        return 'main';
    }

    /**
     * Retrieve the model for a bound value.
     *
     * @param  mixed  $value
     * @param  string|null  $field
     * @return Model|null
     */
    public function resolveRouteBinding($value, $field = null)
    {
        if (empty($value)) {
            return null;
        }

        // If field is customizable (e.g. slug), we skip hashid decoding
        if ($field) {
            return parent::resolveRouteBinding($value, $field);
        }

        // Try to decode
        $decoded = Hashids::connection($this->getHashidsConnection())->decode($value);

        if (empty($decoded)) {
            // Optional: fallback to normal ID search if legacy support needed?
            // For better security, strict check is better.
            return null;
        }

        return $this->where($this->getKeyName(), $decoded[0])->first();
    }

    /**
     * Find a model by its hash id.
     *
     * @param  string  $hashId
     * @return Model|null
     */
    public static function findByHashId($hashId)
    {
        if (empty($hashId) || ! is_string($hashId)) {
            return null;
        }

        $instance = new static;
        $decoded = Hashids::connection($instance->getHashidsConnection())->decode($hashId);

        if (empty($decoded)) {
            return null;
        }

        return static::find($decoded[0]);
    }

    /**
     * Scope a query to valid hash id.
     *
     * @param  Builder  $query
     * @param  string  $hashId
     * @return Builder
     */
    public function scopeWhereHashId($query, $hashId)
    {
        if (empty($hashId) || ! is_string($hashId)) {
            // Return query that will return no results
            return $query->whereRaw('1 = 0');
        }

        $decoded = Hashids::connection($this->getHashidsConnection())->decode($hashId);

        if (empty($decoded)) {
            return $query->whereRaw('1 = 0');
        }

        return $query->where($this->getKeyName(), $decoded[0]);
    }

    /**
     * Encode an ID into a hash string.
     *
     * @param  int|string  $id
     * @return string
     */
    public static function encodeId($id)
    {
        $instance = new static;

        return Hashids::connection($instance->getHashidsConnection())->encode($id);
    }

    /**
     * Decode a hash string into an ID.
     *
     * @param  string  $hashId
     * @return int|null
     */
    public static function decodeId($hashId)
    {
        if (empty($hashId) || ! is_string($hashId)) {
            return null;
        }

        $instance = new static;
        $decoded = Hashids::connection($instance->getHashidsConnection())->decode($hashId);

        return $decoded[0] ?? null;
    }
}
