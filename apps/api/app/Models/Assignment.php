<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Assignment extends Model
{
    use \App\Traits\HasHashId, HasFactory, SoftDeletes;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'class_id',
        'tutor_id',
        'assignment_type_id',
        'title',
        'description',
        'instructions',
        'max_score',
        'assigned_date',
        'due_date',
        'deadline',
        'allow_late_submission',
        'max_attempts',
        'allowed_submission_types',
        'status',
        'mode',
        'quiz_settings',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'assigned_date' => 'date',
            'due_date' => 'date',
            'deadline' => 'datetime',
            'allow_late_submission' => 'boolean',
            'max_score' => 'float',
            'max_attempts' => 'integer',
            'allowed_submission_types' => 'array',
            'quiz_settings' => 'array',
        ];
    }

    /**
     * Get the class that owns the assignment.
     */
    public function class(): BelongsTo
    {
        return $this->belongsTo(ClassRoom::class, 'class_id');
    }

    /**
     * Get the tutor who created the assignment.
     */
    public function tutor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'tutor_id');
    }

    /**
     * Get the assignment type.
     */
    public function assignmentType(): BelongsTo
    {
        return $this->belongsTo(AssignmentType::class, 'assignment_type_id');
    }

    /**
     * Get all submissions for this assignment.
     */
    public function submissions(): HasMany
    {
        return $this->hasMany(Submission::class);
    }

    /**
     * Get all grades for this assignment.
     */
    public function grades(): HasMany
    {
        return $this->hasMany(Grade::class);
    }

    /**
     * Get learning resources attached to this assignment.
     */
    public function learningResources(): BelongsToMany
    {
        return $this->belongsToMany(LearningResource::class, 'assignment_learning_resource')
            ->withPivot('order')
            ->withTimestamps()
            ->orderBy('assignment_learning_resource.order');
    }

    /**
     * Check if assignment is published.
     */
    public function isPublished(): bool
    {
        return $this->status === 'published';
    }

    /**
     * Check if assignment is closed.
     */
    public function isClosed(): bool
    {
        return $this->status === 'closed';
    }

    /**
     * Check if assignment is overdue.
     */
    public function isOverdue(): bool
    {
        return $this->due_date && $this->due_date->isPast();
    }

    /**
     * Get submission rate for this assignment.
     */
    public function getSubmissionRate(): float
    {
        $totalStudents = $this->class->students()->count();
        if ($totalStudents === 0) {
            return 0;
        }

        $submittedCount = $this->submissions()->where('status', '!=', 'not_submitted')->count();

        return round(($submittedCount / $totalStudents) * 100, 2);
    }

    /**
     * Get average score for this assignment.
     */
    public function getAverageScore(): ?float
    {
        $avgScore = $this->submissions()
            ->whereNotNull('score')
            ->avg('score');

        return $avgScore ? round($avgScore, 2) : null;
    }

    /**
     * Scope a query to only include published assignments.
     */
    public function scopePublished($query)
    {
        return $query->where('status', 'published');
    }

    /**
     * Scope a query to only include assignments for a specific class.
     */
    public function scopeForClass($query, $classId)
    {
        return $query->where('class_id', $classId);
    }

    /**
     * Get allowed submission types (default: text only if not set).
     */
    public function getAllowedSubmissionTypes(): array
    {
        $types = $this->allowed_submission_types;

        if (empty($types)) {
            $types = ['text'];
        }

        if ($this->isQuiz() && ! in_array('quiz', $types)) {
            $types[] = 'quiz';
        }

        return $types;
    }

    /**
     * Check if a submission type is allowed.
     */
    public function allowsSubmissionType(string $type): bool
    {
        $allowedTypes = $this->getAllowedSubmissionTypes();

        return in_array($type, $allowedTypes);
    }

    /**
     * Check if text submission is allowed.
     */
    public function allowsTextSubmission(): bool
    {
        return $this->allowsSubmissionType('text');
    }

    /**
     * Check if file submission is allowed.
     */
    public function allowsFileSubmission(): bool
    {
        return $this->allowsSubmissionType('file');
    }

    /**
     * Check if document submission is allowed.
     */
    public function allowsDocumentSubmission(): bool
    {
        return $this->allowsSubmissionType('document');
    }

    /**
     * Check if image submission is allowed.
     */
    public function allowsImageSubmission(): bool
    {
        return $this->allowsSubmissionType('image');
    }

    /**
     * Check if video submission is allowed.
     */
    public function allowsVideoSubmission(): bool
    {
        return $this->allowsSubmissionType('video');
    }

    /**
     * Check if audio submission is allowed.
     */
    public function allowsAudioSubmission(): bool
    {
        return $this->allowsSubmissionType('audio');
    }

    /**
     * Check if link submission is allowed.
     */
    public function allowsLinkSubmission(): bool
    {
        return $this->allowsSubmissionType('link');
    }

    /**
     * Determine if assignment is quiz based.
     */
    public function isQuiz(): bool
    {
        return $this->mode === 'quiz';
    }

    /**
     * Quiz settings accessor with defaults.
     */
    public function getQuizSettingsAttribute($value): array
    {
        $settings = is_array($value) ? $value : (json_decode($value ?? '[]', true) ?? []);

        return array_merge([
            'auto_grade' => true,
            'shuffle_questions' => false,
            'show_correct_answers' => false,
            'show_score_to_student' => true,
            'time_limit_minutes' => null,
        ], $settings);
    }

    /**
     * Relationship: questions.
     */
    public function questions(): HasMany
    {
        return $this->hasMany(AssignmentQuestion::class)->orderBy('order');
    }

    /**
     * Exam sections (IELTS Listening Part, Reading Passage...). Flat legacy quizzes have none.
     */
    public function sections(): HasMany
    {
        return $this->hasMany(AssignmentSection::class)->orderBy('order');
    }
}
