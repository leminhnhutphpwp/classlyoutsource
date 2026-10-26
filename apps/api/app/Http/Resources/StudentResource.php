<?php

namespace App\Http\Resources;

use App\Models\User;
use App\Models\UserLock;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StudentResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        // FINANCE-ONLY viewer (org accountant, kế toán): billing fields are fine (name/contact/
        // enrollment/status), but teaching-derived data must be trimmed so this read can't leak
        // attendance/class information the role is otherwise fail-closed on (design §5 QĐ 3).
        $viewerIsAccountant = auth('api')->user()?->isOrgAccountant() ?? false;

        return [
            '_id' => $this->hash_id,
            'student_code' => $this->student_code,
            'user_id' => User::encodeId($this->user_id),
            'name' => $this->name,
            'parent_name' => $this->parent_name,
            'phone' => $this->phone,
            'email' => $this->email,
            'birth_date' => $this->birth_date?->toDateString(),
            'age' => $this->age,
            'gender' => $this->gender,
            'gender_label' => $this->getGenderLabel(),
            'address' => $this->address,
            'avatar' => $this->avatar,
            'notes' => $this->notes,
            'status' => $this->status,
            'status_label' => $this->getStatusLabel(),

            // Enrollment info (if from pivot)
            'enrollment' => $this->when($this->pivot, function () {
                $isPaused = (bool) ($this->pivot?->is_paused ?? false);

                return [
                    'enrolled_at' => $this->pivot?->enrolled_at,
                    'status' => $this->pivot?->status,
                    'status_label' => $this->getEnrollmentStatusLabel($this->pivot?->status, $isPaused),
                    'notes' => $this->pivot?->notes,
                    'is_paused' => $isPaused,
                    'paused_at' => $this->pivot?->paused_at,
                    'pause_reason' => $this->pivot?->pause_reason,
                ];
            }),

            // Computed fields — teaching-derived, so hidden from a finance-only accountant.
            'active_class_count' => $this->when(
                ! $viewerIsAccountant && $this->relationLoaded('classes'),
                fn () => $this->getActiveClassCount()
            ),
            'attendance_rate' => $this->when(! $viewerIsAccountant, fn () => $this->getAttendanceRate()),
            'attendance_rate_formatted' => $this->when(
                ! $viewerIsAccountant,
                fn () => number_format($this->getAttendanceRate(), 1).'%'
            ),

            // Relationships
            'user' => $this->whenLoaded('user', fn () => new UserResource($this->user)),
            'user_locks' => $this->when(
                $this->relationLoaded('user') && $this->user && $this->user->relationLoaded('activeLocks'),
                function () {
                    return $this->user->activeLocks->map(function ($lock) {
                        return [
                            '_id' => UserLock::encodeId($lock->id),
                            'type' => $lock->type,
                            'type_label' => $this->getLockTypeLabel($lock->type),
                            'status' => $lock->status,
                            'status_label' => $this->getLockStatusLabel($lock->status),
                            'reason' => $lock->reason,
                            'start_at' => $lock->start_at?->toISOString(),
                            'end_at' => $lock->end_at?->toISOString(),
                            'created_at' => $lock->created_at?->toISOString(),
                        ];
                    });
                }
            ),
            'is_locked' => $this->when(
                $this->relationLoaded('user') && $this->user && $this->user->relationLoaded('activeLocks'),
                fn () => $this->user->activeLocks->isNotEmpty()
            ),
            'classes' => $this->when(! $viewerIsAccountant && $this->relationLoaded('classes'), function () {
                return $this->classes->map(function ($class) {
                    // Handle enrolled_at - pivot data may be string or Carbon
                    $enrolledAt = $class->pivot->enrolled_at ?? null;
                    if ($enrolledAt) {
                        // If it's already a string, keep it; otherwise try to format
                        if (is_string($enrolledAt)) {
                            // Already a string, use as is
                        } elseif ($enrolledAt instanceof Carbon || method_exists($enrolledAt, 'toDateString')) {
                            $enrolledAt = $enrolledAt->toDateString();
                        }
                    }

                    return array_merge(
                        (new ClassRoomResource($class))->toArray(request()),
                        [
                            'enrollment' => [
                                'enrolled_at' => $enrolledAt,
                                'status' => $class->pivot->status ?? null,
                                'status_label' => $this->getEnrollmentStatusLabel(
                                    $class->pivot->status ?? null,
                                    (bool) ($class->pivot->is_paused ?? false)
                                ),
                                'notes' => $class->pivot->notes ?? null,
                                'is_paused' => (bool) ($class->pivot->is_paused ?? false),
                                'paused_at' => $class->pivot->paused_at ?? null,
                                'pause_reason' => $class->pivot->pause_reason ?? null,
                            ],
                        ]
                    );
                });
            }),

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
            'active' => 'Đang học',
            'inactive' => 'Tạm nghỉ',
            'graduated' => 'Đã tốt nghiệp',
            default => $this->status ?? 'N/A',
        };
    }

    /**
     * Get gender label in Vietnamese.
     */
    protected function getGenderLabel(): ?string
    {
        if (! $this->gender) {
            return null;
        }

        return match ($this->gender) {
            'male' => 'Nam',
            'female' => 'Nữ',
            'other' => 'Khác',
            default => $this->gender,
        };
    }

    /**
     * Get enrollment status label in Vietnamese.
     */
    protected function getEnrollmentStatusLabel(?string $status, bool $isPaused = false): ?string
    {
        if ($isPaused) {
            return 'Tạm dừng học';
        }

        if (! $status) {
            return null;
        }

        return match ($status) {
            'active' => 'Đang học',
            'inactive' => 'Tạm nghỉ',
            'completed' => 'Đã hoàn thành',
            'dropped' => 'Đã bỏ học',
            default => $status,
        };
    }

    /**
     * Get lock type label in Vietnamese.
     */
    protected function getLockTypeLabel(string $type): string
    {
        return match ($type) {
            'login' => 'Khóa đăng nhập',
            'actions' => 'Khóa thao tác',
            'all' => 'Khóa toàn bộ',
            default => $type,
        };
    }

    /**
     * Get lock status label in Vietnamese.
     */
    protected function getLockStatusLabel(string $status): string
    {
        return match ($status) {
            'scheduled' => 'Đã lên lịch',
            'active' => 'Đang khóa',
            'done' => 'Đã mở',
            'cancelled' => 'Đã hủy',
            default => $status,
        };
    }
}
