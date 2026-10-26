<?php

namespace App\Notifications\Channels;

/** Zalo OA delivery channel. Notifications opt in by implementing toZalo($notifiable): string. */
class ZaloChannel extends AbstractProviderChannel
{
    protected function channelKey(): string
    {
        return 'zalo';
    }

    protected function recipientColumns(): array
    {
        return ['zalo_id', 'phone'];
    }
}
