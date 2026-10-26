<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\Log;

class AbuseMonitor
{
    public static function record(User $user, string $resource, array $payload = []): void
    {
        Log::channel('fraud')->warning('Fraud guard alert', [
            'user_id' => $user->id,
            'resource' => $resource,
            'payload' => $payload,
        ]);
    }
}
