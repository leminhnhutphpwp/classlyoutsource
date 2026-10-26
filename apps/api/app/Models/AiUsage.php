<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * A single billable AI call. Written once per successful Anthropic request by AiClient.
 * `estimated_cost` is derived from config('services.ai.prices') at record time.
 */
class AiUsage extends Model
{
    /** Only created_at is tracked (see migration). */
    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'organization_id',
        'feature',
        'model',
        'input_tokens',
        'output_tokens',
        'estimated_cost',
        'subject_type',
        'subject_id',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'input_tokens' => 'integer',
            'output_tokens' => 'integer',
            'estimated_cost' => 'decimal:6',
            'created_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function subject(): MorphTo
    {
        return $this->morphTo();
    }
}
