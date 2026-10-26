<?php

namespace App\Models;

use App\Traits\HasHashId;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A center (organization) operating expense — Wave 2 finance. Org-anchored (pattern b): the row
 * carries its own organization_id (NOT NULL) and is isolated by where('organization_id', $orgId),
 * NOT via a class. class_id / tutor_id are OPTIONAL attribution (NULL class_id = center overhead).
 * See design §2.5. Public id = hashid; SoftDeletes for auditability.
 */
class CenterExpense extends Model
{
    use HasFactory, HasHashId, SoftDeletes;

    /**
     * Allowed expense categories. VARCHAR-backed (not a DB enum) so the set can grow without a
     * migration; enforced at the application layer (FormRequest) — design §2.5.
     */
    public const CATEGORIES = [
        'rent',
        'utilities',
        'marketing',
        'equipment',
        'software',
        'payroll_other',
        'other',
    ];

    /** An expense is a payable until its actual cash settlement is recorded. */
    public const SETTLEMENT_UNPAID = 'unpaid';

    public const SETTLEMENT_SETTLED = 'settled';

    public const SETTLEMENT_STATUSES = [
        self::SETTLEMENT_UNPAID,
        self::SETTLEMENT_SETTLED,
    ];

    protected $fillable = [
        'organization_id',
        'category',
        'amount',
        'expense_date',
        'description',
        'class_id',
        'tutor_id',
        'payment_method',
        'settlement_status',
        'paid_at',
        'payment_reference',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:0',
            'expense_date' => 'date',
            'paid_at' => 'date',
        ];
    }

    /** A settled expense is a disbursed cash fact — its totals already entered the cash reports. */
    public function isSettled(): bool
    {
        return $this->settlement_status === self::SETTLEMENT_SETTLED;
    }

    /**
     * The organization this expense belongs to (the isolation anchor).
     */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    /**
     * Optional class attribution (per-class profit). NULL = center-level overhead.
     */
    public function class(): BelongsTo
    {
        return $this->belongsTo(ClassRoom::class, 'class_id');
    }

    /**
     * Optional tutor attribution (direct tutor cost, rarely used once payroll covers it).
     */
    public function tutor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'tutor_id');
    }

    /**
     * The member who recorded this expense (audit).
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
