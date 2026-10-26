<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Media Optimization Settings
    |--------------------------------------------------------------------------
    */

    'convert_to_webp' => env('MEDIA_CONVERT_TO_WEBP', true),

    'image_optimization' => [
        'max_width' => env('MEDIA_MAX_WIDTH', 1920),
        'jpeg_quality' => env('MEDIA_JPEG_QUALITY', 85),
        'webp_quality' => env('MEDIA_WEBP_QUALITY', 85),
        'min_size_for_webp' => env('MEDIA_MIN_SIZE_FOR_WEBP', 102400), // 100KB
    ],

    'video_optimization' => [
        'docker_container' => env('FFMPEG_CONTAINER', 'ffmpeg-container'),
        'preset' => env('FFMPEG_PRESET', 'medium'),
        'crf' => env('FFMPEG_CRF', 23),
        'audio_bitrate' => env('FFMPEG_AUDIO_BITRATE', '128k'),
    ],

    'queue' => [
        'connection' => env('MEDIA_QUEUE_CONNECTION', 'redis'),
        'queue_name' => env('MEDIA_QUEUE_NAME', 'media-optimization'),
    ],
];
