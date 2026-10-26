<?php

namespace App\Models;

use App\Traits\HasHashId;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AssignmentSection extends Model
{
    use HasFactory;
    use HasHashId;

    protected $fillable = [
        'assignment_id',
        'section_type',
        'title',
        'instruction',
        'media_id',
        'order',
        'settings',
    ];

    protected function casts(): array
    {
        return [
            'order' => 'integer',
            'settings' => 'array',
        ];
    }

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(Assignment::class, 'assignment_id');
    }

    public function media(): BelongsTo
    {
        return $this->belongsTo(Media::class);
    }

    public function questions(): HasMany
    {
        return $this->hasMany(AssignmentQuestion::class, 'section_id')->orderBy('order');
    }
}
