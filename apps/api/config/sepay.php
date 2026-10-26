<?php

return [
    'webhook_token' => env('SEPAY_WEBHOOK_TOKEN'),
    'pattern' => env('SEPAY_MATCH_PATTERN', 'SE'),
    'prefixes' => [
        'payment' => 'P',
    ],

    // Kill-switch for automatic tuition (P-type) reconciliation in SePayWebhookListener::handlePayment.
    // Ships OFF: the reconcile logic is fully wired but only activates when this is true, so it can be
    // enabled in prod AFTER the feature tests pass.
    'auto_reconcile_payments' => (bool) env('SEPAY_AUTO_RECONCILE_PAYMENTS', false),

    // Amount tolerance (VND) when matching a transfer to a Payment. Underpayment beyond this never
    // auto-completes; overpayment within/over is accepted (surplus logged).
    'tolerance' => (int) env('SEPAY_AMOUNT_TOLERANCE', 0),
];
