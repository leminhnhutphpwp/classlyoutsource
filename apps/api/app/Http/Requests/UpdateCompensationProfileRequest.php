<?php

namespace App\Http\Requests;

use App\Enums\PayModel;
use Illuminate\Validation\Rule;

/**
 * Update a tutor compensation profile. user_id is immutable (the rule belongs to a member) so it is not
 * accepted here. All fields optional (partial PATCH). Same money/percent bounds as create.
 */
class UpdateCompensationProfileRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'pay_model' => ['sometimes', 'string', Rule::in(PayModel::values())],
            'base_salary' => ['nullable', 'numeric', 'min:0', 'max:999999999999'],
            'rate_per_session' => ['nullable', 'numeric', 'min:0', 'max:999999999999'],
            'rate_per_student' => ['nullable', 'numeric', 'min:0', 'max:999999999999'],
            'revenue_share_pct' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'components' => ['nullable', 'array'],
            'session_basis' => ['sometimes', 'string', Rule::in(['completed_session', 'attendance_taught'])],
            'currency' => ['sometimes', 'string', 'size:3'],
            'effective_from' => ['sometimes', 'date_format:Y-m-d'],
            'effective_to' => ['nullable', 'date_format:Y-m-d'],
            'status' => ['sometimes', 'string', Rule::in(['active', 'archived'])],
        ];
    }
}
