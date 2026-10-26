<?php

namespace App\Http\Resources;

use App\Models\ClassRoom;
use App\Models\Media;
use App\Models\Student;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LessonNoteResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        // Format student_notes with student info
        $studentNotes = [];
        if ($this->student_notes && is_array($this->student_notes)) {
            foreach ($this->student_notes as $note) {
                $student = Student::find($note['student_id'] ?? null);
                $studentNotes[] = [
                    'student_id' => isset($note['student_id']) ? Student::encodeId($note['student_id']) : null,
                    'student' => $student ? [
                        '_id' => $student->hash_id,
                        'name' => $student->name,
                    ] : null,
                    'behavior' => $note['behavior'] ?? null,
                    'behavior_label' => $this->getBehaviorLabel($note['behavior'] ?? null),
                    'note' => $note['note'] ?? null,
                ];
            }
        }

        // Format attachments (media IDs array)
        $attachments = [];
        if ($this->attachments && is_array($this->attachments)) {
            foreach ($this->attachments as $mediaId) {
                $media = Media::find($mediaId);
                if ($media) {
                    $attachments[] = [
                        '_id' => User::encodeId($media->id),
                        'name' => $media->name,
                        'url' => $media->url ?? (method_exists($media, 'getUrl') ? $media->getUrl() : null),
                        'type' => $media->type,
                        'size' => $media->size,
                    ];
                }
            }
        }

        return [
            '_id' => $this->hash_id,
            'class_id' => ClassRoom::encodeId($this->class_id),
            'tutor_id' => User::encodeId($this->tutor_id),
            'lesson_date' => $this->lesson_date?->toDateString(),
            'topic' => $this->topic,
            'content' => $this->content,
            'homework' => $this->homework,
            'observations' => $this->observations,
            'student_notes' => $studentNotes,
            'student_notes_count' => count($studentNotes),
            'rating' => $this->rating,
            'rating_stars' => $this->getRatingStars(),
            'attachments' => $attachments,
            'attachments_count' => count($attachments),
            'has_homework' => ! empty($this->homework),
            'has_attachments' => ! empty($attachments),

            // Learning Resources (from library)
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
            'learning_resources_count' => $this->whenLoaded('learningResources', fn () => $this->learningResources->count()) ?? 0,

            // Relationships
            'class' => new ClassRoomResource($this->whenLoaded('class')),
            'tutor' => new UserResource($this->whenLoaded('tutor')),

            // Legacy fields (backward compatibility)
            'title' => $this->title,
            'objectives' => $this->objectives,
            'materials' => $this->materials,
            'student_performance' => $this->student_performance,
            'notes' => $this->notes,

            // Timestamps
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }

    /**
     * Get behavior label in Vietnamese.
     */
    private function getBehaviorLabel(?string $behavior): ?string
    {
        return match ($behavior) {
            'excellent' => 'Xuất sắc',
            'good' => 'Tốt',
            'average' => 'Trung bình',
            'poor' => 'Cần cải thiện',
            default => null,
        };
    }
}
