<?php

namespace App\Http\Resources;

use App\Models\Assignment;
use App\Models\ClassRoom;
use App\Models\GradeType;
use App\Models\Student;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GradeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            '_id' => $this->hash_id,
            'class_id' => ClassRoom::encodeId($this->class_id),
            'student_id' => Student::encodeId($this->student_id),
            'tutor_id' => User::encodeId($this->tutor_id),
            'grade_type_id' => GradeType::encodeId($this->grade_type_id),
            'assignment_id' => $this->assignment_id ? Assignment::encodeId($this->assignment_id) : null,
            'title' => $this->title,
            'score' => $this->score,
            'max_score' => $this->max_score,
            'percentage' => $this->getPercentage(),
            'grade_letter' => $this->getGradeLetter(),
            // Thang điểm + nhãn xếp loại do BACKEND quyết định, để mọi màn hình phân loại giống nhau.
            // Frontend không được tự quy đổi phần trăm rồi áp ngưỡng 90/80/70/60 — sai với thang
            // chứng chỉ (IELTS 0–9, TOEIC 0–990).
            'grading_scale' => $this->gradingScale(),
            'grade_label' => $this->getGradeLabel(),
            'is_passing' => $this->isPassing(),
            'grade_date' => $this->grade_date?->toDateString(),
            'semester' => $this->semester,
            'comments' => $this->comments,

            // Relationships
            'class' => new ClassRoomResource($this->whenLoaded('class')),
            'student' => new StudentResource($this->whenLoaded('student')),
            'tutor' => new UserResource($this->whenLoaded('tutor')),
            'grade_type' => $this->whenLoaded('gradeType', fn () => $this->gradeType ? new GradeTypeResource($this->gradeType) : null),
            'assignment' => new AssignmentResource($this->whenLoaded('assignment')),

            // Timestamps
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
