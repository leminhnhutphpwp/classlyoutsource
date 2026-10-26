<?php

namespace App\Policies;

use App\Models\PayrollItem;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * A payslip is the immutable money-history row (design §6 risks 3,4). Read-only in the admin interface;
 * only super_admin / admin may view (via the PayrollPeriod items relationship). No mutation is ever
 * allowed through it — approved/paid items change only through an in-app correction adjustment.
 */
class PayrollItemPolicy
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

    public function view(User $user, PayrollItem $payrollItem): bool
    {
        return $this->isBackOffice($user);
    }

    public function create(User $user): bool
    {
        return false;
    }

    public function update(User $user, PayrollItem $payrollItem): bool
    {
        return false;
    }

    public function delete(User $user, PayrollItem $payrollItem): bool
    {
        return false;
    }

    public function deleteAny(User $user): bool
    {
        return false;
    }

    public function restore(User $user, PayrollItem $payrollItem): bool
    {
        return false;
    }

    public function forceDelete(User $user, PayrollItem $payrollItem): bool
    {
        return false;
    }
}
