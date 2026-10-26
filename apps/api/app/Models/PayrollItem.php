<?php

namespace App\Models;

use App\Traits\HasHashId;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * One payslip / member / period — Wave 3 payroll. The IMMUTABLE money-history row (design §6 risks 3,4):
 * organization_id + user_id + pay_model + every amount are HARD SNAPSHOTS, so a member leaving/moving
 * org can never make their historical payslip vanish or leak into a new org, and editing the profile
 * later never rewrites this. unique(payroll_period_id, user_id) is the idempotency key for recompute.
 */
class PayrollItem extends Model
{
    use HasFactory, HasHashId, SoftDeletes;

    public const STATUS_DRAFT = 'draft';

    public const STATUS_APPROVED = 'approved';

    public const STATUS_PAID = 'paid';

    protected $fillable = [
        'organization_id',
        'payroll_period_id',
        'user_id',
        'compensation_profile_id',
        'pay_model',
        'base_amount',
        'sessions_count',
        'sessions_amount',
        'students_count',
        'students_amount',
        'revenue_base',
        'revenue_amount',
        'adjustments_total',
        'gross_amount',
        'computation_breakdown',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'base_amount' => 'decimal:0',
            'sessions_count' => 'integer',
            'sessions_amount' => 'decimal:0',
            'students_count' => 'integer',
            'students_amount' => 'decimal:0',
            'revenue_base' => 'decimal:0',
            'revenue_amount' => 'decimal:0',
            'adjustments_total' => 'decimal:0',
            'gross_amount' => 'decimal:0',
            'computation_breakdown' => 'array',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function period(): BelongsTo
    {
        return $this->belongsTo(PayrollPeriod::class, 'payroll_period_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function compensationProfile(): BelongsTo
    {
        return $this->belongsTo(TutorCompensationProfile::class, 'compensation_profile_id');
    }

    public function adjustments(): HasMany
    {
        return $this->hasMany(PayrollAdjustment::class);
    }

    /** An approved/paid item is locked — changes go through a correction adjustment, never an edit. */
    public function isLocked(): bool
    {
        return in_array($this->status, [self::STATUS_APPROVED, self::STATUS_PAID], true);
    }
}
