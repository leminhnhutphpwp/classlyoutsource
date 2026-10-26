<?php

namespace App\Enums;

/**
 * Organization membership roles (organization_members.org_role). String-backed because the set is
 * EXTENSIBLE (receptionist etc. land later) — stored as VARCHAR(20), never a DB enum (design §2.1).
 *
 * Capability tiers:
 *  - owner      → owns the organization; full org control; the only role that can pay out.
 *  - manager    → full teaching + operational visibility of the whole org.
 *  - accountant → FINANCE-ONLY, least-privilege: reads payments / payment-requests / student billing,
 *                 fail-closed on ALL teaching data (classes/attendance/grades/...). NOT a viewer-all.
 *  - tutor      → a plain member; sees only their own teaching data.
 */
enum OrgRole: string
{
    case Owner = 'owner';
    case Manager = 'manager';
    case Accountant = 'accountant';
    case Tutor = 'tutor';

    /** All backing values — for `Rule::in(...)` / `in:` validation. */
    public static function values(): array
    {
        return array_map(fn (self $r) => $r->value, self::cases());
    }

    /**
     * Roles a member can be CREATED as / changed TO via the API (owner is bootstrapped with the org,
     * never assignable through member endpoints).
     */
    public static function assignableValues(): array
    {
        return [self::Manager->value, self::Accountant->value, self::Tutor->value];
    }

    /** owner || manager → may view/aggregate the WHOLE org (teaching + finance). */
    public function isViewerAll(): bool
    {
        return $this === self::Owner || $this === self::Manager;
    }
}
