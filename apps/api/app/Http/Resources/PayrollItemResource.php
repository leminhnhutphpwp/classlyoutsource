<?php

namespace App\Http\Resources;

use App\Models\PayrollPeriod;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Shapes a payroll_items row (one payslip). Serves both the owner/manager org view AND a member-tutor's
 * own approved payslip — it exposes only snapshotted amounts + this payslip's own breakdown, never other
 * members' data or a rate table (design §5 QĐ 8). Public ids are hashids.
 */
class PayrollItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            '_id' => $this->hash_id,
            'period_id' => $this->payroll_period_id ? PayrollPeriod::encodeId($this->payroll_period_id) : null,
            // Period context (only when eager-loaded, e.g. my-payslips) so the payslip row can show the
            // period label/window + the paid date instead of blanks. paid_at comes from the period
            // (items don't carry their own) → null until the period is marked paid → "Chưa trả" in the UI.
            'period_label' => $this->whenLoaded('period', fn () => $this->period?->label),
            'period_start' => $this->whenLoaded('period', fn () => optional($this->period?->period_start)->toDateString()),
            'period_end' => $this->whenLoaded('period', fn () => optional($this->period?->period_end)->toDateString()),
            'paid_at' => $this->whenLoaded('period', fn () => optional($this->period?->paid_at)->toDateString()),
            'user_id' => $this->user_id ? User::encodeId($this->user_id) : null,
            'user_name' => $this->whenLoaded('user', fn () => $this->user?->name),
            'pay_model' => $this->pay_model,
            'base_amount' => (float) $this->base_amount,
            'sessions_count' => (int) $this->sessions_count,
            'sessions_amount' => (float) $this->sessions_amount,
            'students_count' => (int) $this->students_count,
            'students_amount' => (float) $this->students_amount,
            'revenue_base' => (float) $this->revenue_base,
            'revenue_amount' => (float) $this->revenue_amount,
            'adjustments_total' => (float) $this->adjustments_total,
            'gross_amount' => (float) $this->gross_amount,
            'computation_breakdown' => $this->computation_breakdown,
            'status' => $this->status,
            'adjustments' => PayrollAdjustmentResource::collection($this->whenLoaded('adjustments')),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
