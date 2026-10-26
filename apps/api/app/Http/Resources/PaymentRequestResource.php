<?php

namespace App\Http\Resources;

use App\Models\ClassRoom;
use App\Models\User;
use App\Support\CurrencyHelper;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PaymentRequestResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        // Only calculate summary if class is loaded
        $summary = null;
        if ($this->relationLoaded('class')) {
            try {
                $summary = $this->getStatusSummary();
            } catch (\Exception $e) {
                // If calculation fails, return empty summary
                $summary = [];
            }
        }

        return [
            '_id' => $this->hash_id,
            'class_id' => ClassRoom::encodeId($this->class_id),
            'created_by' => User::encodeId($this->created_by),
            'period_name' => $this->period_name,
            'period_month' => $this->period_month,
            'amount_per_student' => (float) $this->amount_per_student,
            'amount_per_student_formatted' => CurrencyHelper::formatWithoutSign($this->amount_per_student),
            'due_date' => $this->due_date?->toDateString(),
            'description' => $this->description,
            'status' => $this->status,
            'status_label' => match ($this->status) {
                'pending' => 'Chưa bắt đầu',
                'active' => 'Đang áp dụng',
                'cancelled' => 'Đã hủy',
                default => $this->status,
            },
            'metadata' => $this->metadata ?? [],

            // Statistics (only if class is loaded)
            'statistics' => $summary,

            // Relationships
            'class' => $this->whenLoaded('class', fn () => new ClassRoomResource($this->class)),
            'creator' => $this->whenLoaded('creator', fn () => new UserResource($this->creator)),
            'payments' => $this->whenLoaded('payments', fn () => PaymentResource::collection($this->payments)),

            // Timestamps
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
