<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Submission extends Model
{
    use \App\Traits\HasHashId, HasFactory, SoftDeletes;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'assignment_id',
        'student_id',
        'content',
        'media_id', // NEW: Media
        'external_url', // NEW: Link submission
        'attachments', // DEPRECATED: Keep for backward compatibility
        'submitted_at',
        'started_at', // Thời gian bắt đầu làm bài (cho quiz)
        'time_spent_minutes', // Thời gian làm bài tính bằng phút (cho quiz)
        'is_late',
        'score',
        'feedback',
        'graded_by',
        'graded_at',
        'status',
        'submission_type',
        'attempt_number',
        'ai_suggested_score', // AI advisory score (tutor reviews before accepting)
        'ai_feedback',
        'ai_graded_at',
        'ai_confidence', // AI self-confidence (0..1) — drives the tutor review queue
        'ai_criteria', // AI rubric breakdown (name/score/comment) shown on the result screen
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'attachments' => 'array',
            'submitted_at' => 'datetime',
            'started_at' => 'datetime',
            'time_spent_minutes' => 'integer',
            'graded_at' => 'datetime',
            'is_late' => 'boolean',
            'score' => 'decimal:2',
            'attempt_number' => 'integer',
            'ai_suggested_score' => 'decimal:2',
            'ai_graded_at' => 'datetime',
            'ai_confidence' => 'decimal:2',
            'ai_criteria' => 'array',
        ];
    }

    /**
     * Get the assignment that owns the submission.
     */
    public function assignment(): BelongsTo
    {
        return $this->belongsTo(Assignment::class);
    }

    /**
     * Get the student who made the submission.
     */
    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    /**
     * Get the tutor who graded the submission.
     */
    public function grader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'graded_by');
    }

    /**
     * Get the media file (Media).
     */
    public function media(): BelongsTo
    {
        return $this->belongsTo(Media::class);
    }

    /**
     * Check if submission is graded.
     */
    public function isGraded(): bool
    {
        return $this->status === 'graded';
    }

    /**
     * Check if submission is submitted.
     */
    public function isSubmitted(): bool
    {
        return $this->status !== 'not_submitted';
    }

    /**
     * Check if submission is late.
     */
    public function isLate(): bool
    {
        return $this->is_late;
    }

    /**
     * Mark submission as graded.
     */
    public function markAsGraded(float $score, ?string $feedback = null, ?int $gradedBy = null): bool
    {
        $this->score = $score;
        $this->feedback = $feedback;
        $this->graded_by = $gradedBy;
        $this->graded_at = now();
        $this->status = 'graded';

        return $this->save();
    }

    /**
     * Get score percentage.
     */
    public function getScorePercentage(): ?float
    {
        if (! $this->score || ! $this->assignment->max_score) {
            return null;
        }

        return round(($this->score / $this->assignment->max_score) * 100, 2);
    }

    /**
     * Scope a query to only include graded submissions.
     */
    public function scopeGraded($query)
    {
        return $query->where('status', 'graded');
    }

    /**
     * Scope a query to only include submitted submissions.
     */
    public function scopeSubmitted($query)
    {
        return $query->where('status', '!=', 'not_submitted');
    }

    /**
     * Scope a query to only include late submissions.
     */
    public function scopeLate($query)
    {
        return $query->where('is_late', true);
    }

    /**
     * Scope a query to only include submissions for a specific assignment.
     */
    public function scopeForAssignment($query, $assignmentId)
    {
        return $query->where('assignment_id', $assignmentId);
    }

    /**
     * Scope a query to only include submissions for a specific student.
     */
    public function scopeForStudent($query, $studentId)
    {
        return $query->where('student_id', $studentId);
    }

    public function questionResponses(): HasMany
    {
        return $this->hasMany(AssignmentQuestionSubmission::class);
    }

    public function isQuizSubmission(): bool
    {
        return $this->submission_type === 'quiz';
    }
}
