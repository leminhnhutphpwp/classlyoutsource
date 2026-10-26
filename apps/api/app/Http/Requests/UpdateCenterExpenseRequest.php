<?php

namespace App\Http\Requests;

use App\Models\CenterExpense;
use App\Models\ClassRoom;
use App\Models\User;
use App\Rules\ExistsHashId;
use Illuminate\Validation\Rule;

/**
 * Patch a center expense (partial). Same guarantees as the store request: organization_id / created_by
 * are immutable and never read from the body; class_id / tutor_id are re-validated against the org in
 * the controller. All fields are optional ('sometimes') so a partial PATCH is honoured.
 */
class UpdateCenterExpenseRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'category' => ['sometimes', 'required', 'string', Rule::in(CenterExpense::CATEGORIES)],
            'amount' => ['sometimes', 'required', 'integer', 'min:1', 'max:999999999999'],
            'expense_date' => ['sometimes', 'required', 'date_format:Y-m-d'],
            'description' => ['nullable', 'string', 'max:255'],
            'class_id' => ['nullable', new ExistsHashId(ClassRoom::class)],
            'tutor_id' => ['nullable', new ExistsHashId(User::class)],
            'payment_method' => ['nullable', 'string', 'max:20'],
            'settlement_status' => ['nullable', 'string', Rule::in(CenterExpense::SETTLEMENT_STATUSES)],
            'paid_at' => ['nullable', 'date_format:Y-m-d'],
            'payment_reference' => ['nullable', 'string', 'max:64'],
        ];
    }
}
