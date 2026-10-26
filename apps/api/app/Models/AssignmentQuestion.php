<?php

namespace App\Models;

use App\Traits\HasHashId;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AssignmentQuestion extends Model
{
    use HasFactory;
    use HasHashId;

    protected $fillable = [
        'assignment_id',
        'section_id',
        'media_id',
        'question_type',
        'title',
        'description',
        'explanation',
        'points',
        'order',
        'settings',
    ];

    protected function casts(): array
    {
        return [
            'points' => 'float',
            'settings' => 'array',
        ];
    }

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(Assignment::class);
    }

    /** Exam section this question belongs to (null = legacy flat quiz). */
    public function section(): BelongsTo
    {
        return $this->belongsTo(AssignmentSection::class, 'section_id');
    }

    /** Optional media prompt: audio (listening) or an image/diagram. */
    public function media(): BelongsTo
    {
        return $this->belongsTo(Media::class);
    }

    public function options(): HasMany
    {
        return $this->hasMany(AssignmentQuestionOption::class, 'question_id')->orderBy('order');
    }

    public function submissions(): HasMany
    {
        return $this->hasMany(AssignmentQuestionSubmission::class, 'question_id');
    }
}
