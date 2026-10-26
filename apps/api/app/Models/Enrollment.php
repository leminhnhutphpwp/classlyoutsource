<?php

namespace App\Models;

use App\Traits\HasHashId;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Pivot model for class_student relationship
 */
class Enrollment extends Model
{
    use HasHashId;

    protected $table = 'class_student';

    protected $originalClassId;

    protected static function booted(): void
    {
        static::updating(function (Enrollment $enrollment) {
            $enrollment->originalClassId = $enrollment->getOriginal('class_id');
        });

        static::created(function (Enrollment $enrollment) {
            $enrollment->flushUsageCache();
        });

        static::saved(function (Enrollment $enrollment) {
            $enrollment->flushUsageCache();

            if ($enrollment->originalClassId && $enrollment->originalClassId !== $enrollment->class_id) {
                $enrollment->flushUsageCache($enrollment->originalClassId);
            }

            $enrollment->originalClassId = null;
        });

        static::deleted(function (Enrollment $enrollment) {
            $enrollment->flushUsageCache();
        });
    }

    protected $fillable = [
        'class_id',
        'student_id',
        'enrolled_at',
        'status',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'enrolled_at' => 'date',
        ];
    }

    /**
     * Get the class.
     */
    public function class(): BelongsTo
    {
        return $this->belongsTo(ClassRoom::class, 'class_id');
    }

    /**
     * Get the student.
     */
    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class, 'student_id');
    }

    /**
     * Check if enrollment is active.
     */
    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    /**
     * Scope: Active enrollments.
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    /**
     * Scope: For specific class.
     */
    public function scopeForClass($query, int $classId)
    {
        return $query->where('class_id', $classId);
    }

    /**
     * Scope: For specific student.
     */
    public function scopeForStudent($query, int $studentId)
    {
        return $query->where('student_id', $studentId);
    }

    /**
     * Scope: For specific tutor (via class).
     */
    public function scopeForTutor($query, int $tutorId)
    {
        return $query->whereHas('class', function ($q) use ($tutorId) {
            $q->where('tutor_id', $tutorId);
        });
    }

    protected function flushUsageCache(?int $targetClassId = null): void
    {
        // Usage cache no longer needed (usage tracking removed).
    }
}
