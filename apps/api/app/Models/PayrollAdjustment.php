<?php

namespace App\Models;

use App\Traits\HasHashId;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A manual bonus / deduction / advance / correction against a payslip — Wave 3 payroll. Org-anchored
 * (pattern b). This is the ONLY way an approved/paid item changes its total (never an in-place edit —
 * design §6 risk 4). Signed amount; reason required for audit. Public id = hashid.
 */
class PayrollAdjustment extends Model
{
    use HasFactory, HasHashId, SoftDeletes;

    public const TYPES = ['bonus', 'deduction', 'advance', 'correction'];

    protected $fillable = [
        'organization_id',
        'payroll_item_id',
        'type',
        'amount',
        'reason',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:0',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(PayrollItem::class, 'payroll_item_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
