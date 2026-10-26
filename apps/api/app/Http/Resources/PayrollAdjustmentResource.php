<?php

namespace App\Http\Resources;

use App\Models\PayrollItem;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Shapes a payroll_adjustments row. Public ids are hashids.
 */
class PayrollAdjustmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            '_id' => $this->hash_id,
            'item_id' => $this->payroll_item_id ? PayrollItem::encodeId($this->payroll_item_id) : null,
            'type' => $this->type,
            'amount' => (float) $this->amount,
            'reason' => $this->reason,
            'created_by' => $this->created_by ? User::encodeId($this->created_by) : null,
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
