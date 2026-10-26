<?php

namespace App\Http\Requests;

use App\Models\PayrollAdjustment;
use Illuminate\Validation\Rule;

/**
 * Add a manual adjustment to a payslip. organization_id / payroll_item_id / created_by are stamped by
 * the controller from context — never the body. amount is signed (a deduction/correction may be
 * negative); reason is REQUIRED for audit (design §2.4).
 */
class StorePayrollAdjustmentRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'type' => ['required', 'string', Rule::in(PayrollAdjustment::TYPES)],
            // bonus/advance must be positive; deduction must be negative; correction is explicitly signed.
            'amount' => ['required', 'numeric', 'min:-999999999999', 'max:999999999999', 'not_in:0', function ($attribute, $value, $fail) {
                $type = request()->input('type');
                if ($type === 'bonus' || $type === 'advance') {
                    if ((float) $value <= 0) {
                        $fail('Thưởng/tạm ứng phải là số dương.');
                    }
                } elseif ($type === 'deduction') {
                    if ((float) $value >= 0) {
                        $fail('Khấu trừ phải là số âm.');
                    }
                }
            }],
            'reason' => ['required', 'string', 'max:255'],
        ];
    }
}
