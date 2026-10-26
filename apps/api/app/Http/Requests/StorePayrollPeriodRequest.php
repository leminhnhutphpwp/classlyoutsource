<?php

namespace App\Http\Requests;

/**
 * Create a payroll period (pay run). organization_id / reference_code are stamped by the controller,
 * never trusted from the body. period_start..period_end is an inclusive window (default cadence: a
 * calendar month, but stored explicitly so any cadence works — design §5 QĐ 6).
 */
class StorePayrollPeriodRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'period_start' => ['required', 'date_format:Y-m-d'],
            'period_end' => ['required', 'date_format:Y-m-d', 'after_or_equal:period_start'],
            'label' => ['nullable', 'string', 'max:120'],
        ];
    }
}
