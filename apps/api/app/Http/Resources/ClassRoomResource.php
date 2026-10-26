<?php

namespace App\Http\Resources;

use App\Models\Subject;
use App\Models\User;
use App\Support\CurrencyHelper;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ClassRoomResource extends JsonResource
{
    /**
     * Get student count (from eager count or method).
     */
    protected function getStudentCount(): int
    {
        if (isset($this->active_students_count)) {
            return (int) $this->active_students_count;
        }

        return $this->getActiveStudentCount();
    }

    /**
     * Get available slots (using eager count if available).
     */
    protected function getAvailableSlotsComputed(): int
    {
        $count = $this->getStudentCount();

        return $this->max_students ? max(0, $this->max_students - $count) : 0;
    }

    /**
     * Check if class is full (using eager count if available).
     */
    protected function isFullComputed(): bool
    {
        $count = $this->getStudentCount();

        return $this->max_students && $count >= $this->max_students;
    }

    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            '_id' => $this->hash_id,
            'tutor_id' => User::encodeId($this->tutor_id),
            'subject_id' => Subject::encodeId($this->subject_id),
            'name' => $this->name,
            'class_code' => $this->class_code,
            'subject' => $this->subject,
            'description' => $this->description,
            'start_date' => $this->start_date?->toDateString(),
            'end_date' => $this->end_date?->toDateString(),
            'schedule' => $this->schedule,
            'tuition_fee' => $this->tuition_fee ? (float) $this->tuition_fee : null,
            'tuition_fee_formatted' => $this->tuition_fee ? CurrencyHelper::formatWithoutSign($this->tuition_fee) : null,
            'max_students' => $this->max_students,
            'status' => $this->status,
            'status_label' => $this->getStatusLabel(),

            // Computed fields - Always show student count
            'students_count' => $this->getStudentCount(),
            'available_slots' => $this->getAvailableSlotsComputed(),
            'is_full' => $this->isFullComputed(),

            // Relationships
            'tutor' => $this->whenLoaded('tutor', fn () => new UserResource($this->tutor)),
            'subject_relation' => $this->whenLoaded('subject', fn () => $this->subject),

            // Timestamps
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }

    /**
     * Get status label in Vietnamese.
     */
    protected function getStatusLabel(): string
    {
        return match ($this->status) {
            'active' => 'Đang hoạt động',
            'inactive' => 'Tạm ngưng',
            'completed' => 'Đã hoàn thành',
            default => $this->status ?? 'N/A',
        };
    }
}
