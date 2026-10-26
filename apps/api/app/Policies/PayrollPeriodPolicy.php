<?php

namespace App\Policies;

use App\Models\PayrollPeriod;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * Payroll runs are an immutable money history and are STRICTLY read-only — an admin must never silently
 * mutate an approved/paid pay run (design §6 risk 4); corrections happen in-app via adjustments.
 * Only super_admin / admin may view; tutors/students never reach it. super_admin bypasses every check;
 * every mutation ability is denied here regardless.
 */
class PayrollPeriodPolicy
{
    use HandlesAuthorization;

    private function isBackOffice(User $user): bool
    {
        return $user->isSuperAdmin() || $user->isAdmin();
    }

    public function viewAny(User $user): bool
    {
        return $this->isBackOffice($user);
    }

    public function view(User $user, PayrollPeriod $payrollPeriod): bool
    {
        return $this->isBackOffice($user);
    }

    public function create(User $user): bool
    {
        return false;
    }

    public function update(User $user, PayrollPeriod $payrollPeriod): bool
    {
        return false;
    }

    public function delete(User $user, PayrollPeriod $payrollPeriod): bool
    {
        return false;
    }

    public function deleteAny(User $user): bool
    {
        return false;
    }

    public function restore(User $user, PayrollPeriod $payrollPeriod): bool
    {
        return false;
    }

    public function forceDelete(User $user, PayrollPeriod $payrollPeriod): bool
    {
        return false;
    }
}
