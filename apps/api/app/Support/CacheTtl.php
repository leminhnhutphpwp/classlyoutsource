<?php

namespace App\Support;

class CacheTtl
{
    /**
     * TTL values in seconds.
     */
    public const MASTER_DATA = 900; // 15 minutes

    // Detail pages cache (2 minutes)
    public const DETAIL = 120; // 2 minutes

    // Nested data cache (1 minute)
    public const NESTED_DATA = 60; // 1 minute

    // List pages cache (3 minutes)
    public const LIST = 180; // 3 minutes

    // Reference data cache (15 minutes - ít thay đổi)
    public const REFERENCE_DATA = 900; // 15 minutes
}
