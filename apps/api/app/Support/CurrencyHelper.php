<?php

namespace App\Support;

class CurrencyHelper
{
    /**
     * Default currency symbol.
     */
    private const DEFAULT_CURRENCY = '₫';

    /**
     * Default currency for VND.
     */
    private const VND_CURRENCY = 'VND';

    /**
     * Format currency amount.
     *
     * @param  string  $currency  Currency symbol (default: ₫)
     * @param  bool  $showSign  Show + sign for positive amounts
     */
    public static function format(float|int|string|null $amount, string $currency = self::DEFAULT_CURRENCY, bool $showSign = false): string
    {
        if ($amount === null) {
            return '0 '.$currency;
        }

        $amount = (float) $amount;
        $sign = $showSign && $amount >= 0 ? '+' : '';

        return $sign.number_format($amount, 0, ',', '.').' '.$currency;
    }

    /**
     * Format currency with sign (+ for positive, - for negative).
     *
     * @param  string  $currency  Currency symbol (default: ₫)
     */
    public static function formatWithSign(float|int|string|null $amount, string $currency = self::DEFAULT_CURRENCY): string
    {
        return self::format($amount, $currency, showSign: true);
    }

    /**
     * Format currency without sign (always positive display).
     *
     * @param  string  $currency  Currency symbol (default: ₫)
     */
    public static function formatWithoutSign(float|int|string|null $amount, string $currency = self::DEFAULT_CURRENCY): string
    {
        return self::format($amount, $currency, showSign: false);
    }

    /**
     * Format VND currency (for widgets and the admin interface).
     */
    public static function formatVND(float|int|string|null $amount): string
    {
        return self::format($amount, self::VND_CURRENCY, showSign: false);
    }

    /**
     * Format currency for display in messages/notifications.
     *
     * @param  string  $currency  Currency symbol (default: ₫)
     */
    public static function formatForMessage(float|int|string|null $amount, string $currency = self::DEFAULT_CURRENCY): string
    {
        return self::format($amount, $currency, showSign: false);
    }
}
