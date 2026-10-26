<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class LessonNote extends Model
{
    use \App\Traits\HasHashId, HasFactory, SoftDeletes;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'lesson_notes';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'class_id',
        'tutor_id',
        'lesson_date',
        'topic',
        'content',
        'homework',
        'observations',
        'student_notes',
        'rating',
        'attachments',
        // Legacy fields for backward compatibility
        'date',
        'materials_used',
        'objectives',
        'overall_rating',
        'next_lesson_plan',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'lesson_date' => 'date',
            'student_notes' => 'array',
            'attachments' => 'array',
            'rating' => 'integer',
        ];
    }

    /**
     * Get the class that the lesson note belongs to.
     */
    public function class(): BelongsTo
    {
        return $this->belongsTo(ClassRoom::class, 'class_id');
    }

    /**
     * Get the tutor who created the lesson note.
     */
    public function tutor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'tutor_id');
    }

    /**
     * Get learning resources attached to this lesson note.
     */
    public function learningResources(): BelongsToMany
    {
        return $this->belongsToMany(LearningResource::class, 'lesson_note_learning_resource')
            ->withPivot('order')
            ->withTimestamps()
            ->orderBy('lesson_note_learning_resource.order');
    }

    /**
     * Check if lesson has homework.
     */
    public function hasHomework(): bool
    {
        return ! empty($this->homework);
    }

    /**
     * Check if lesson has been rated.
     */
    public function isRated(): bool
    {
        return $this->rating !== null;
    }

    /**
     * Get rating stars.
     */
    public function getRatingStars(): string
    {
        if (! $this->rating) {
            return '-';
        }

        return $this->rating.' sao';
    }

    /**
     * Scope a query to only include notes for a specific class.
     */
    public function scopeForClass($query, $classId)
    {
        return $query->where('class_id', $classId);
    }

    /**
     * Scope a query to only include notes for a specific tutor.
     */
    public function scopeForTutor($query, $tutorId)
    {
        return $query->where('tutor_id', $tutorId);
    }

    /**
     * Scope a query to only include notes for a specific date.
     */
    public function scopeForDate($query, $date)
    {
        return $query->whereDate('lesson_date', $date);
    }

    /**
     * Scope a query to only include notes with high ratings.
     */
    public function scopeHighRated($query)
    {
        return $query->where('rating', '>=', 4);
    }
}
