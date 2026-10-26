<?php

namespace App\Models;

use App\Traits\HasHashId;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * The pay RULE for one member (tutor) — Wave 3 payroll. Org-anchored (pattern b): the row carries its
 * own organization_id (NOT NULL) and isolates by where('organization_id', $orgId), NOT via a class —
 * salary rules attach to a MEMBER (design §2.4). One ACTIVE profile per member; history via
 * effective_from/to + status. Public id = hashid; SoftDeletes for auditability.
 */
class TutorCompensationProfile extends Model
{
    use HasFactory, HasHashId, SoftDeletes;

    protected $fillable = [
        'organization_id',
        'user_id',
        'pay_model',
        'base_salary',
        'rate_per_session',
        'rate_per_student',
        'revenue_share_pct',
        'components',
        'session_basis',
        'currency',
        'effective_from',
        'effective_to',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'base_salary' => 'decimal:0',
            'rate_per_session' => 'decimal:0',
            'rate_per_student' => 'decimal:0',
            'revenue_share_pct' => 'decimal:2',
            'components' => 'array',
            'effective_from' => 'date',
            'effective_to' => 'date',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Scope to the ACTIVE profile(s) whose effective window covers $date (default: today). Used by the
     * calculator to pick the single rule in force for a member during a period.
     */
    public function scopeActiveOn(Builder $query, string $date): Builder
    {
        return $query->where('status', 'active')
            ->whereDate('effective_from', '<=', $date)
            ->where(function ($q) use ($date) {
                $q->whereNull('effective_to')->orWhereDate('effective_to', '>=', $date);
            });
    }
}
