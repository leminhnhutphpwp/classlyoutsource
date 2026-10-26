<?php

namespace App\Http\Resources;

use App\Models\AssignmentType;
use App\Models\ClassRoom;
use App\Models\Enrollment;
use App\Models\Student;
use App\Models\User;
use App\Services\Assignments\AssignmentWorkflowService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AssignmentResource extends JsonResource
{
    private static ?int $cachedStudentUserId = null;

    private static ?int $cachedStudentId = null;

    private static array $studentEnrollmentCache = [];

    public function toArray(Request $request): array
    {
        $data = [
            '_id' => $this->hash_id,
            'class_id' => ClassRoom::encodeId($this->class_id),
            'tutor_id' => User::encodeId($this->tutor_id),
            'assignment_type_id' => AssignmentType::encodeId($this->assignment_type_id),
            'title' => $this->title,
            'description' => $this->description,
            'instructions' => $this->instructions,
            'max_score' => $this->max_score,
            'assigned_date' => $this->assigned_date?->toDateString(),
            'due_date' => $this->due_date?->toDateString(),
            'deadline' => $this->deadline?->toISOString(),
            'allow_late_submission' => $this->allow_late_submission,
            'max_attempts' => $this->max_attempts,
            'allowed_submission_types' => $this->getAllowedSubmissionTypes(),
            'status' => $this->status,
            'status_label' => $this->getStatusLabel(),
            'mode' => $this->mode ?? 'standard',

            // Statistics - Always show submission counts
            'submissions_count' => isset($this->submissions_count)
                ? (int) $this->submissions_count
                : $this->submissions()->count(),
            'graded_submissions_count' => isset($this->graded_submissions_count)
                ? (int) $this->graded_submissions_count
                : $this->submissions()->where('status', 'graded')->count(),
            'pending_submissions_count' => isset($this->pending_submissions_count)
                ? (int) $this->pending_submissions_count
                : $this->submissions()->where('status', 'pending')->count(),

            // Relationships
            'class' => new ClassRoomResource($this->whenLoaded('class')),
            'tutor' => new UserResource($this->whenLoaded('tutor')),
            'assignment_type' => $this->whenLoaded('assignmentType', fn () => $this->assignmentType ? new AssignmentTypeResource($this->assignmentType) : null),
            'learning_resources' => $this->whenLoaded('learningResources', function () {
                return $this->learningResources->map(function ($resource) {
                    return [
                        '_id' => $resource->hash_id,
                        'title' => $resource->title,
                        'type' => $resource->type,
                        'description' => $resource->description,
                        'external_url' => $resource->external_url,
                        'file_url' => $resource->getFileUrl(),
                        'file_size' => $resource->getFileSizeFormatted(),
                        'order' => $resource->pivot->order ?? 0,
                    ];
                });
            }),

            // Timestamps
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];

        $extras = app(AssignmentWorkflowService::class)
            ->transformAssignmentResource($this->resource, $request);

        if (! empty($extras)) {
            $data = array_merge($data, $extras);
        }

        if ($studentEnrollment = $this->studentEnrollmentData($request)) {
            $data['student_enrollment'] = $studentEnrollment;
            $data['is_paused_for_current_student'] = $studentEnrollment['is_paused'];
        } else {
            $data['student_enrollment'] = null;
            $data['is_paused_for_current_student'] = false;
        }

        return $data;
    }

    private function studentEnrollmentData(Request $request): ?array
    {
        $user = $request->user('api');

        if (! $user || ! $user->isStudent()) {
            return null;
        }

        if (self::$cachedStudentUserId !== $user->id) {
            self::$cachedStudentUserId = $user->id;
            self::$cachedStudentId = Student::where('user_id', $user->id)->value('id');
            self::$studentEnrollmentCache = [];
        }

        if (! self::$cachedStudentId) {
            return null;
        }

        if (! array_key_exists($this->class_id, self::$studentEnrollmentCache)) {
            $enrollment = Enrollment::where('student_id', self::$cachedStudentId)
                ->where('class_id', $this->class_id)
                ->select(['status', 'is_paused', 'paused_at', 'pause_reason', 'enrolled_at'])
                ->first();

            if (! $enrollment) {
                self::$studentEnrollmentCache[$this->class_id] = null;
            } else {
                $enrolledAt = $enrollment->enrolled_at;
                if ($enrolledAt && method_exists($enrolledAt, 'toDateString')) {
                    $enrolledAt = $enrolledAt->toDateString();
                }

                self::$studentEnrollmentCache[$this->class_id] = [
                    'status' => $enrollment->status,
                    'is_paused' => (bool) $enrollment->is_paused,
                    'paused_at' => $enrollment->paused_at,
                    'pause_reason' => $enrollment->pause_reason,
                    'enrolled_at' => $enrolledAt,
                ];
            }
        }

        return self::$studentEnrollmentCache[$this->class_id];
    }

    /**
     * Get status label in Vietnamese.
     */
    protected function getStatusLabel(): string
    {
        return match ($this->status) {
            'draft' => 'Bản nháp',
            'published' => 'Đã xuất bản',
            'closed' => 'Đã đóng',
            default => $this->status ?? 'N/A',
        };
    }
}
