<?php

namespace App\Notifications\Channels;

/** SMS delivery channel. Notifications opt in by implementing toSms($notifiable): string. */
class SmsChannel extends AbstractProviderChannel
{
    protected function channelKey(): string
    {
        return 'sms';
    }

    protected function recipientColumns(): array
    {
        return ['phone'];
    }
}
