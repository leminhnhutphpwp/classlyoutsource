<?php

namespace App\Services\Notifications\Drivers;

/**
 * A delivery driver for an external notification channel (Zalo OA, SMS, ...). Implementations receive
 * the resolved recipient, the rendered message, and the live credentials pulled from the
 * NotificationChannel DB row — they never read env/config directly, so a provider swap is config + DB only.
 */
interface NotificationDriver
{
    /**
     * @param  array<string,mixed>  $credentials  {api_key, api_secret, config, provider}
     * @return array{success:bool,provider?:string,error?:string,response?:mixed}
     */
    public function send(string $to, string $message, array $credentials = []): array;
}
