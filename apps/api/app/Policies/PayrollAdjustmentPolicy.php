<?php

namespace App\Policies;

use App\Models\PayrollAdjustment;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * Manual bonus/deduction/advance/correction rows against a payslip (audit trail). Read-only in the admin
 * interface; only super_admin / admin may view. No mutation through it — adjustments are created only
 * through the in-app payroll workflow.
 */
class PayrollAdjustmentPolicy
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

    public function view(User $user, PayrollAdjustment $payrollAdjustment): bool
    {
        return $this->isBackOffice($user);
    }

    public function create(User $user): bool
    {
        return false;
    }

    public function update(User $user, PayrollAdjustment $payrollAdjustment): bool
    {
        return false;
    }

    public function delete(User $user, PayrollAdjustment $payrollAdjustment): bool
    {
        return false;
    }

    public function deleteAny(User $user): bool
    {
        return false;
    }

    public function restore(User $user, PayrollAdjustment $payrollAdjustment): bool
    {
        return false;
    }

    public function forceDelete(User $user, PayrollAdjustment $payrollAdjustment): bool
    {
        return false;
    }
}
