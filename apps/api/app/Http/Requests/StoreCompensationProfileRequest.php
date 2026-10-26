<?php

namespace App\Http\Requests;

use App\Models\User;
use App\Rules\ExistsHashId;
use Illuminate\Validation\Rule;

/**
 * Create a tutor compensation profile (pay rule). organization_id is NEVER trusted from the body — the
 * controller stamps it from the caller's active membership; user_id is validated for FORMAT here and
 * org-membership-checked in the controller (no cross-org member injection). Money >= 0; pct 0..100.
 */
class StoreCompensationProfileRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'user_id' => ['required', new ExistsHashId(User::class)],
            // Only the pay models with a REAL calculation are accepted — per_student/hybrid are
            // schema-only in v1 and would silently pay zero (audit finding), so they are rejected here.
            'pay_model' => ['required', 'string', Rule::in(['fixed_monthly', 'per_session', 'revenue_share'])],
            'base_salary' => ['nullable', 'numeric', 'min:0', 'max:999999999999'],
            'rate_per_session' => ['nullable', 'numeric', 'min:0', 'max:999999999999'],
            'rate_per_student' => ['nullable', 'numeric', 'min:0', 'max:999999999999'],
            'revenue_share_pct' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'components' => ['nullable', 'array'],
            'session_basis' => ['nullable', 'string', Rule::in(['completed_session', 'attendance_taught'])],
            'currency' => ['nullable', 'string', 'size:3'],
            'effective_from' => ['required', 'date_format:Y-m-d'],
            'effective_to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:effective_from'],
        ];
    }
}
