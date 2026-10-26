<?php

namespace App\Models;

use App\Traits\HasHashId;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A pay run of an org — Wave 3 payroll. Org-anchored (pattern b). Holds the state machine
 * draft → approved → paid (cancel only from draft). period_start/period_end are stored EXPLICITLY so
 * any cadence works without a migration (design §5 QĐ 6). Public id = hashid.
 */
class PayrollPeriod extends Model
{
    use HasFactory, HasHashId, SoftDeletes;

    public const STATUS_DRAFT = 'draft';

    public const STATUS_APPROVED = 'approved';

    public const STATUS_PAID = 'paid';

    public const STATUS_CANCELLED = 'cancelled';

    /**
     * Calculation lifecycle — SEPARATE from the financial status. The queued compute and the approval
     * transition are made mutually exclusive by this state + a per-run token (see PayrollPeriodController
     * + PayrollCalculator): a period cannot be approved until its CURRENT run is `completed`, and a stale
     * job (token no longer current) aborts without touching the snapshot.
     */
    public const CALC_NOT_STARTED = 'not_started';

    public const CALC_QUEUED = 'queued';

    public const CALC_COMPUTING = 'computing';

    public const CALC_COMPLETED = 'completed';

    public const CALC_FAILED = 'failed';

    public const CALC_IN_FLIGHT = [self::CALC_QUEUED, self::CALC_COMPUTING];

    protected $fillable = [
        'organization_id',
        'reference_code',
        'period_start',
        'period_end',
        'label',
        'status',
        'calculation_status',
        'calculation_token',
        'calculation_started_at',
        'calculation_error',
        'computed_at',
        'approved_by',
        'approved_at',
        'paid_by',
        'paid_at',
        'total_amount',
    ];

    protected function casts(): array
    {
        return [
            'period_start' => 'date',
            'period_end' => 'date',
            'calculation_started_at' => 'datetime',
            'computed_at' => 'datetime',
            'approved_at' => 'datetime',
            'paid_at' => 'datetime',
            'total_amount' => 'decimal:0',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(PayrollItem::class);
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function payer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'paid_by');
    }

    /** Draft is the ONLY state where compute may (re)write items (design §6 risk 4). */
    public function isDraft(): bool
    {
        return $this->status === self::STATUS_DRAFT;
    }

    public function isApproved(): bool
    {
        return $this->status === self::STATUS_APPROVED;
    }

    public function isPaid(): bool
    {
        return $this->status === self::STATUS_PAID;
    }

    public function isCancelled(): bool
    {
        return $this->status === self::STATUS_CANCELLED;
    }

    /**
     * Compute is BLOCKED once the run is approved or beyond — the snapshot is chosen; changes must go
     * through an adjustment instead (design §6 risk 4). Only a draft is (re)computable.
     */
    public function isComputable(): bool
    {
        return $this->isDraft();
    }

    /** A fresh calculation run may be claimed only when none is already in flight. */
    public function isCalculationInFlight(): bool
    {
        return in_array($this->calculation_status, self::CALC_IN_FLIGHT, true);
    }

    /** The snapshot is approvable only once the CURRENT run finished successfully with items. */
    public function isCalculationCompleted(): bool
    {
        return $this->calculation_status === self::CALC_COMPLETED && $this->computed_at !== null;
    }
}
