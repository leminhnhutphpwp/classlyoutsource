<?php

namespace App\Support;

use App\Models\Media;

/**
 * Shape a Media record for the FE: the URL to render plus enough metadata to pick the
 * right element (<img> for images, <audio> for audio). Null when nothing is attached.
 * Shared by every payload that embeds media (questions, options, sections, submissions).
 */
class MediaShape
{
    public static function shape(?Media $media): ?array
    {
        if (! $media) {
            return null;
        }

        return [
            'id' => $media->id,
            'url' => $media->url,
            'type' => $media->type,
            'name' => $media->name,
            'ext' => $media->ext,
        ];
    }
}
