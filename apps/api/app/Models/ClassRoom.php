<?php

namespace App\Models;

use App\Traits\HasHashId;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ClassRoom extends Model
{
    use HasFactory, HasHashId, SoftDeletes;

    protected $originalTutorId;

    protected static function booted(): void
    {
        static::updating(function (ClassRoom $classRoom) {
            $classRoom->originalTutorId = $classRoom->getOriginal('tutor_id');
        });

        static::creating(function (ClassRoom $classRoom) {
            if (empty($classRoom->class_code)) {
                $classRoom->class_code = self::generateClassCode();
            }
        });

        static::saved(function (ClassRoom $classRoom) {
            // Usage cache no longer needed (usage tracking removed).

            if ($classRoom->originalTutorId && $classRoom->originalTutorId !== $classRoom->tutor_id) {
                // Usage cache no longer needed.
            }

            $classRoom->originalTutorId = null;
        });

        static::deleted(function (ClassRoom $classRoom) {
            // Usage cache no longer needed.
        });
    }

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'classes';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'tutor_id',
        'organization_id',
        'subject_id',
        'name',
        'subject',
        'start_date',
        'end_date',
        'schedule',
        'tuition_fee',
        'max_students',
        'description',
        'class_code',
        'status',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'schedule' => 'array',
            'tuition_fee' => 'decimal:2',
            'max_students' => 'integer',
        ];
    }

    /**
     * Get the tutor of the class.
     */
    public function tutor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'tutor_id');
    }

    /**
     * Get the organization this class belongs to (nullable — NULL = solo tutor class).
     */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class, 'organization_id');
    }

    /**
     * Get the subject of the class.
     */
    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    /**
     * Get all enrolled students (many-to-many).
     */
    public function students(): BelongsToMany
    {
        return $this->belongsToMany(Student::class, 'class_student', 'class_id', 'student_id')
            ->withPivot('id', 'enrolled_at', 'status', 'notes', 'is_paused', 'paused_at', 'resumed_at', 'pause_reason')
            ->withTimestamps()
            ->orderBy('class_student.enrolled_at', 'desc');
    }

    /**
     * Get only active enrolled students.
     */
    public function activeStudents(): BelongsToMany
    {
        return $this->students()
            ->wherePivot('status', 'active')
            ->wherePivot('is_paused', false);
    }

    /**
     * Get count of active students.
     */
    public function getActiveStudentCount(): int
    {
        try {
            // If students are already loaded via eager loading
            if ($this->relationLoaded('students') && $this->students) {
                return $this->students
                    ->where('pivot.status', 'active')
                    ->where('pivot.is_paused', false)
                    ->count();
            }

            // Otherwise, query database
            return $this->activeStudents()->count();
        } catch (\Exception $e) {
            // Fallback: return 0 if query fails
            return 0;
        }
    }

    /**
     * Check if class is full (reached max_students).
     */
    public function isFull(): bool
    {
        return $this->getActiveStudentCount() >= $this->max_students;
    }

    /**
     * Get available slots.
     */
    public function getAvailableSlots(): int
    {
        if ($this->max_students === null) {
            return 0;
        }

        return max(0, $this->max_students - $this->getActiveStudentCount());
    }

    /**
     * Get all schedules for this class.
     */
    public function schedules(): HasMany
    {
        return $this->hasMany(Schedule::class, 'class_id');
    }

    /**
     * Get all schedule sessions (generated from recurring schedules).
     */
    public function scheduleSessions(): HasMany
    {
        return $this->hasMany(ScheduleSession::class, 'class_id');
    }

    /**
     * Get all class sessions (the live schedule_sessions table).
     */
    public function sessions(): HasMany
    {
        return $this->hasMany(ScheduleSession::class, 'class_id');
    }

    /**
     * Get all attendance records for this class.
     */
    public function attendances(): HasMany
    {
        return $this->hasMany(Attendance::class, 'class_id');
    }

    /**
     * Get all payments for this class.
     */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class, 'class_id');
    }

    /**
     * Get all payment requests for this class.
     */
    public function paymentRequests(): HasMany
    {
        return $this->hasMany(PaymentRequest::class, 'class_id');
    }

    /**
     * Get all assignments for this class.
     */
    public function assignments(): HasMany
    {
        return $this->hasMany(Assignment::class, 'class_id');
    }

    /**
     * Get all lesson notes for this class.
     */
    public function lessonNotes(): HasMany
    {
        return $this->hasMany(LessonNote::class, 'class_id');
    }

    /**
     * Get all grades for this class.
     */
    public function grades(): HasMany
    {
        return $this->hasMany(Grade::class, 'class_id');
    }

    /**
     * Check if class is currently active.
     */
    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    /**
     * Scope a query to only include active classes.
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public static function generateClassCode()
    {
        $prefix = config('app_codes.class.prefix', 'CLS');
        $separator = config('app_codes.class.separator', '-');
        $length = (int) config('app_codes.class.suffix_length', 4);
        $year = date('Y');

        do {
            $length = max(1, $length);
            $min = pow(10, $length - 1);
            $max = pow(10, $length) - 1;
            $random = mt_rand($min, $max);

            $code = "{$prefix}{$separator}{$year}{$separator}{$random}";
        } while (self::where('class_code', $code)->exists());

        return $code;
    }
}
