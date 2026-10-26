<?php

namespace App\Services\Notifications;

use App\Services\Notifications\Drivers\LogDriver;
use App\Services\Notifications\Drivers\NotificationDriver;

/**
 * Resolves a driver key (from config('notifications.channels.*.driver')) to a concrete
 * NotificationDriver via config('notifications.drivers'). Unknown/misconfigured keys fall back to the
 * LogDriver so a bad config can never throw mid-send (fail-safe, not fail-open — nothing paid goes out).
 */
class NotificationDriverManager
{
    /** @var array<string,NotificationDriver> */
    private array $resolved = [];

    public function driver(string $key): NotificationDriver
    {
        if (isset($this->resolved[$key])) {
            return $this->resolved[$key];
        }

        $class = config("notifications.drivers.$key");
        $instance = ($class && class_exists($class) && is_subclass_of($class, NotificationDriver::class))
            ? app($class)
            : app(LogDriver::class);

        return $this->resolved[$key] = $instance;
    }
}
