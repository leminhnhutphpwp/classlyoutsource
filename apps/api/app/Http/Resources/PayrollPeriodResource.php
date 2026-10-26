<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Shapes a payroll_periods row (a pay run). Public id = hashid; raw organization_id not exposed.
 */
class PayrollPeriodResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            '_id' => $this->hash_id,
            'reference_code' => $this->reference_code,
            'period_start' => $this->period_start?->toDateString(),
            'period_end' => $this->period_end?->toDateString(),
            'label' => $this->label,
            'status' => $this->status,
            'calculation_status' => $this->calculation_status,
            'calculation_error' => $this->calculation_error,
            // When the worker CLAIMED the run (queued→computing) — lets the UI time an in-flight run
            // and flag one that never gets claimed (dead queue worker) instead of spinning forever.
            'calculation_started_at' => $this->calculation_started_at?->toISOString(),
            'computed_at' => $this->computed_at?->toISOString(),
            'approved_by' => $this->approved_by ? User::encodeId($this->approved_by) : null,
            'approved_at' => $this->approved_at?->toISOString(),
            'paid_by' => $this->paid_by ? User::encodeId($this->paid_by) : null,
            'paid_at' => $this->paid_at?->toISOString(),
            'total_amount' => (float) $this->total_amount,
            'items_count' => $this->whenCounted('items'),
            'items' => PayrollItemResource::collection($this->whenLoaded('items')),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
