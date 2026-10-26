<?php

namespace App\Http\Controllers\API\V1;

use App\Models\Setting;
use Illuminate\Http\JsonResponse;

class SystemConfigController extends BaseController
{
    /**
     * Get public system configuration.
     * Used by frontend clients to configure locale, timezone, and display settings.
     */
    public function index(): JsonResponse
    {
        $config = [
            'app' => [
                'name' => Setting::get('general.site_name', config('app.name')),
                'timezone' => Setting::get('general.timezone', config('app.timezone')),
                'locale' => Setting::get('general.locale', config('app.locale')),
                'currency' => Setting::get('general.currency', 'VND'),
            ],
            'contact' => [
                'support_phone' => Setting::get('general.support_phone'),
                'support_email' => Setting::get('general.support_email'),
            ],
            'payment' => [
                'bank_transfer_enabled' => (bool) Setting::get('payment.bank_transfer_enabled', false),
            ],
        ];

        return $this->successResponse($config);
    }
}
