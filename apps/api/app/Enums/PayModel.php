<?php

namespace App\Enums;

/**
 * Compensation pay models (tutor_compensation_profiles.pay_model / payroll_items.pay_model). A
 * PERMANENTLY-fixed set → backed by a DB enum too (design §2.0). v1 IMPLEMENTS calculation for exactly
 * three (fixed_monthly, per_session, revenue_share — the models with clean existing signals, design §5
 * QĐ 1); per_student + hybrid carry schema columns but the calculator returns 0 for them (v2).
 */
enum PayModel: string
{
    case FixedMonthly = 'fixed_monthly';
    case PerSession = 'per_session';
    case PerStudent = 'per_student';   // v2 — schema only, calculator returns 0
    case RevenueShare = 'revenue_share';
    case Hybrid = 'hybrid';            // v2 — schema only, calculator returns 0

    /** All backing values — for `Rule::in(...)` / `in:` validation. */
    public static function values(): array
    {
        return array_map(fn (self $m) => $m->value, self::cases());
    }

    /** The pay models whose calculation is actually IMPLEMENTED in v1. */
    public static function computableValues(): array
    {
        return [self::FixedMonthly->value, self::PerSession->value, self::RevenueShare->value];
    }

    /** Whether v1 computes a real amount for this model (false → schema-only placeholder). */
    public function isComputable(): bool
    {
        return in_array($this->value, self::computableValues(), true);
    }
}
