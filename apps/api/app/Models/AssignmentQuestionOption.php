<?php

namespace App\Models;

use App\Traits\HasHashId;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssignmentQuestionOption extends Model
{
    use HasFactory;
    use HasHashId;

    protected $fillable = [
        'question_id',
        'media_id',
        'label',
        'content',
        'is_correct',
        'feedback',
        'order',
    ];

    protected function casts(): array
    {
        return [
            'is_correct' => 'boolean',
        ];
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(AssignmentQuestion::class, 'question_id');
    }

    /** Optional image attached to this answer choice. */
    public function media(): BelongsTo
    {
        return $this->belongsTo(Media::class);
    }
}
