<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssignmentQuestionSubmission extends Model
{
    use HasFactory;

    protected $fillable = [
        'submission_id',
        'question_id',
        'selected_option_id',
        'selected_option_ids',
        'text_answer',
        'response',
        'score',
        'is_correct',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'score' => 'float',
            'is_correct' => 'boolean',
            'selected_option_ids' => 'array',
            'response' => 'array',
            'meta' => 'array',
        ];
    }

    public function submission(): BelongsTo
    {
        return $this->belongsTo(Submission::class);
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(AssignmentQuestion::class);
    }

    public function selectedOption(): BelongsTo
    {
        return $this->belongsTo(AssignmentQuestionOption::class, 'selected_option_id');
    }
}
