<?php

namespace App\Support;

use App\Models\Payment;
use Illuminate\Support\Str;

class ReferenceCode
{
    /**
     * Generate a unique random alphanumeric reference code for any model.
     */
    public static function generate(string $modelClass, string $prefix = '', int $length = 8): string
    {
        // Get the global prefix from config (e.g., 'CLS')
        $globalPrefix = config('sepay.pattern', 'CLS');
        $fullPrefix = $globalPrefix.$prefix;

        do {
            $code = $fullPrefix.strtoupper(Str::random($length));
        } while ($modelClass::where('reference_code', $code)->exists());

        return $code;
    }

    /**
     * Specialized generator for Tuition Payments.
     */
    public static function forPayment(): string
    {
        return self::generate(Payment::class, 'PAY');
    }

    /**
     * Generate Invoice Number for Payment.
     */
    public static function invoiceForPayment(): string
    {
        $prefix = config('sepay.prefixes.payment', 'P');

        return 'INV'.$prefix.'-'.date('Ymd').'-'.strtoupper(substr(uniqid(), -6));
    }

    /**
     * Fallback for legacy Payments.
     */
    public static function fallbackPayment(int $id): string
    {
        $prefix = config('sepay.pattern', 'CLS');

        return $prefix.'PAY'.Payment::encodeId($id);
    }
}
