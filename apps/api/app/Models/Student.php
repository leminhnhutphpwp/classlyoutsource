<?php

namespace App\Models;

use App\Traits\HasHashId;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Student extends Model
{
    use HasFactory, HasHashId, SoftDeletes;

    protected static function boot()
    {
        parent::boot();
        static::creating(function ($student) {
            if (empty($student->student_code)) {
                $student->student_code = self::generateStudentCode();
            }
        });
    }

    public static function generateStudentCode()
    {
        $prefix = config('app_codes.student.prefix', 'HV');
        $separator = config('app_codes.student.separator', '');
        $length = (int) config('app_codes.student.suffix_length', 6);
        $year = date('Y');

        do {
            // Generate random numeric string of specific length
            // Ensure length is at least 1 to avoid error
            $length = max(1, $length);
            $min = pow(10, $length - 1);
            $max = pow(10, $length) - 1;
            $random = mt_rand($min, $max);

            $code = "{$prefix}{$separator}{$year}{$separator}{$random}";
        } while (self::where('student_code', $code)->exists());

        return $code;
    }

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'class_id',
        'user_id',
        'created_by',
        'name',
        'parent_name',
        'phone',
        'email',
        'birth_date',
        'gender',
        'address',
        'avatar',
        'notes',
        'student_code',
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
            'birth_date' => 'date',
        ];
    }

    /**
     * Get all classes that the student is enrolled in (many-to-many).
     */
    public function classes(): BelongsToMany
    {
        return $this->belongsToMany(ClassRoom::class, 'class_student', 'student_id', 'class_id')
            ->withPivot('id', 'enrolled_at', 'status', 'notes', 'is_paused', 'paused_at', 'resumed_at', 'pause_reason')
            ->withTimestamps()
            ->orderBy('class_student.enrolled_at', 'desc');
    }

    /**
     * Parent/guardian User accounts linked to this student (active links only).
     */
    public function guardians(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'guardian_student', 'student_id', 'user_id')
            ->withPivot('relationship', 'is_primary', 'status')
            ->wherePivot('status', 'active')
            ->withTimestamps();
    }

    /**
     * Get the primary class (deprecated - use classes() for multi-class support).
     *
     * @deprecated Use classes() relationship instead
     */
    public function class(): BelongsTo
    {
        return $this->belongsTo(ClassRoom::class, 'class_id');
    }

    /**
     * Get the user account associated with this student.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the user who created this student profile.
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get all attendance records for this student.
     */
    public function attendances(): HasMany
    {
        return $this->hasMany(Attendance::class);
    }

    /**
     * Get all payments for this student.
     */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    /**
     * Get all submissions for this student.
     */
    public function submissions(): HasMany
    {
        return $this->hasMany(Submission::class);
    }

    /**
     * Get all grades for this student.
     */
    public function grades(): HasMany
    {
        return $this->hasMany(Grade::class);
    }

    /**
     * Get the student's age.
     */
    public function getAgeAttribute(): ?int
    {
        return $this->birth_date ? $this->birth_date->age : null;
    }

    /**
     * Check if student is active.
     */
    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    /**
     * Get attendance rate for a given period.
     */
    public function getAttendanceRate($startDate = null, $endDate = null): float
    {
        $query = $this->attendances();

        if ($startDate) {
            $query->where('date', '>=', $startDate);
        }
        if ($endDate) {
            $query->where('date', '<=', $endDate);
        }

        $total = $query->count();
        if ($total === 0) {
            return 0;
        }

        $present = $query->where('status', 'present')->count();

        return round(($present / $total) * 100, 2);
    }

    /**
     * Check if student is enrolled in a specific class.
     */
    public function isEnrolledIn(int $classId): bool
    {
        return $this->classes()->where('class_id', $classId)->exists();
    }

    /**
     * Get enrollment status for a specific class.
     */
    public function getEnrollmentStatus(int $classId): ?string
    {
        $enrollment = $this->classes()->where('class_id', $classId)->first();

        return $enrollment?->pivot->status;
    }

    /**
     * Get all active class enrollments.
     */
    public function getActiveClasses()
    {
        return $this->classes()
            ->wherePivot('status', 'active')
            ->wherePivot('is_paused', false)
            ->get();
    }

    /**
     * Get count of active enrollments.
     */
    public function getActiveClassCount(): int
    {
        return $this->classes()
            ->wherePivot('status', 'active')
            ->wherePivot('is_paused', false)
            ->count();
    }

    /**
     * Scope a query to only include active students.
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    /**
     * Determine if the student is paused in a specific class.
     */
    public function isPausedInClass(int $classId): bool
    {
        return $this->classes()
            ->where('class_id', $classId)
            ->wherePivot('is_paused', true)
            ->exists();
    }

    /**
     * Scope a query to only include students of a specific class.
     */
    public function scopeForClass($query, $classId)
    {
        return $query->where('class_id', $classId);
    }
}
