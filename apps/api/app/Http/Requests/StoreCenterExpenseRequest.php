<?php

namespace App\Http\Requests;

use App\Models\CenterExpense;
use App\Models\ClassRoom;
use App\Models\User;
use App\Rules\ExistsHashId;
use Illuminate\Validation\Rule;

/**
 * Create a center expense. organization_id / created_by are NEVER trusted from the body — the
 * controller stamps them from the caller's active membership. class_id / tutor_id are validated here
 * for FORMAT only (a real hashid of an existing row); the controller then rejects any that don't
 * belong to THIS org (cross-org injection). category is constrained to the allowed set, amount > 0.
 */
class StoreCenterExpenseRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'category' => ['required', 'string', Rule::in(CenterExpense::CATEGORIES)],
            // Money is whole VND (decimal(12,0)) — a fractional input would silently round, so reject it.
            'amount' => ['required', 'integer', 'min:1', 'max:999999999999'],
            'expense_date' => ['required', 'date_format:Y-m-d'],
            'description' => ['nullable', 'string', 'max:255'],
            'class_id' => ['nullable', new ExistsHashId(ClassRoom::class)],
            'tutor_id' => ['nullable', new ExistsHashId(User::class)],
            'payment_method' => ['nullable', 'string', 'max:20'],
            // Settlement: providing a payment method (or settling) marks the bill as disbursed.
            'settlement_status' => ['nullable', 'string', Rule::in(CenterExpense::SETTLEMENT_STATUSES)],
            'paid_at' => ['nullable', 'date_format:Y-m-d'],
            'payment_reference' => ['nullable', 'string', 'max:64'],
        ];
    }
}
