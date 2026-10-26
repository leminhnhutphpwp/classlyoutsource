<?php

namespace App\Http\Resources;

use App\Models\ClassRoom;
use App\Models\Student;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AttendanceResource extends JsonResource
{
    /**
     * Get status information.
     */
    protected function getStatusInfo(string $status): array
    {
        return match ($status) {
            'present' => [
                'value' => 'present',
                'label' => 'Có mặt',
                'label_en' => 'Present',
                'color' => 'success',
                'icon' => 'check-circle',
            ],
            'absent' => [
                'value' => 'absent',
                'label' => 'Vắng',
                'label_en' => 'Absent',
                'color' => 'danger',
                'icon' => 'x-circle',
            ],
            'late' => [
                'value' => 'late',
                'label' => 'Đi muộn',
                'label_en' => 'Late',
                'color' => 'warning',
                'icon' => 'clock',
            ],
            'excused' => [
                'value' => 'excused',
                'label' => 'Có phép',
                'label_en' => 'Excused',
                'color' => 'info',
                'icon' => 'document-check',
            ],
            default => [
                'value' => $status,
                'label' => ucfirst($status),
                'label_en' => ucfirst($status),
                'color' => 'secondary',
                'icon' => 'question-mark-circle',
            ],
        };
    }

    public function toArray(Request $request): array
    {
        $statusInfo = $this->getStatusInfo($this->status);

        return [
            '_id' => $this->hash_id,
            'class_id' => ClassRoom::encodeId($this->class_id),
            'student_id' => Student::encodeId($this->student_id),
            'tutor_id' => User::encodeId($this->tutor_id),
            'date' => $this->date?->toDateString(),
            'check_in_time' => $this->check_in_time?->format('H:i'),
            'check_out_time' => $this->check_out_time?->format('H:i'),
            'status' => $this->status,
            'status_info' => $statusInfo,
            'note' => $this->note,

            // Relationships
            'class' => new ClassRoomResource($this->whenLoaded('class')),
            'student' => new StudentResource($this->whenLoaded('student')),
            'tutor' => new UserResource($this->whenLoaded('tutor')),

            // Timestamps
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
