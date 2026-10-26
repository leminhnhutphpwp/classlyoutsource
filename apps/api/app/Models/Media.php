<?php

namespace App\Models;

use App\Traits\HasHashId;
use Database\Factories\MediaFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

/**
 * In-house media library record mapped to the existing `media` table.
 *
 * Keeps the same table shape, hashid encoding, and a storage-backed `url` accessor so every
 * consumer (avatars, learning resources, lesson notes, submissions, assignment questions/options,
 * org logos and the optimization pipeline) keeps working unchanged.
 */
class Media extends Model
{
    /** @use HasFactory<MediaFactory> */
    use HasFactory, HasHashId;

    protected $table = 'media';

    protected $fillable = [
        'disk',
        'directory',
        'visibility',
        'name',
        'path',
        'optimized_path',
        'optimize_status',
        'optimize_meta',
        'optimized_at',
        'width',
        'height',
        'size',
        'type',
        'ext',
        'mime_type',
        'alt',
        'title',
        'description',
        'caption',
        'exif',
        'curations',
        'tenant_id',
    ];

    protected function casts(): array
    {
        return [
            'width' => 'integer',
            'height' => 'integer',
            'size' => 'integer',
            'optimize_meta' => 'array',
            'exif' => 'array',
            'curations' => 'array',
            'optimized_at' => 'datetime',
        ];
    }

    /**
     * Storage URL for the file (original path). Mirrors the fallback used everywhere the packaged
     * model's `url` accessor was previously relied upon.
     */
    public function getUrlAttribute(): ?string
    {
        $path = $this->path;

        if (! $path) {
            return null;
        }

        return Storage::disk($this->disk ?? 'public')->url($path);
    }
}
