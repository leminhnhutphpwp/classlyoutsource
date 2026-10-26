<?php

namespace App\Http\Resources;

use App\Models\ClassRoom;
use App\Models\User;
use App\Support\CurrencyHelper;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Shapes a center_expenses row for the API. Public ids are hashids only (never raw ids); the raw
 * organization_id is intentionally NOT exposed — the caller already knows their org from context.
 */
class CenterExpenseResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            '_id' => $this->hash_id,
            'category' => $this->category,
            'amount' => (float) $this->amount,
            'amount_formatted' => CurrencyHelper::formatWithoutSign($this->amount),
            'expense_date' => $this->expense_date?->toDateString(),
            'description' => $this->description,
            'class_id' => $this->class_id ? ClassRoom::encodeId($this->class_id) : null,
            'tutor_id' => $this->tutor_id ? User::encodeId($this->tutor_id) : null,
            'payment_method' => $this->payment_method,
            'created_by' => $this->created_by ? User::encodeId($this->created_by) : null,
            'class' => new ClassRoomResource($this->whenLoaded('class')),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
