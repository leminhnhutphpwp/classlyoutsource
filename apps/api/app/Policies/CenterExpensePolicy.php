<?php

namespace App\Policies;

use App\Models\CenterExpense;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * Center finance is internal data. Only super_admin / admin may inspect it; tutors and students must
 * never reach it. super_admin additionally bypasses every check. All mutation abilities are denied here —
 * the admin surface is read-mostly for center finance; the source of truth is the app's own org-scoped
 * workflow.
 */
class CenterExpensePolicy
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

    public function view(User $user, CenterExpense $centerExpense): bool
    {
        return $this->isBackOffice($user);
    }

    public function create(User $user): bool
    {
        return false;
    }

    public function update(User $user, CenterExpense $centerExpense): bool
    {
        return false;
    }

    public function delete(User $user, CenterExpense $centerExpense): bool
    {
        return false;
    }

    public function deleteAny(User $user): bool
    {
        return false;
    }

    public function restore(User $user, CenterExpense $centerExpense): bool
    {
        return false;
    }

    public function forceDelete(User $user, CenterExpense $centerExpense): bool
    {
        return false;
    }
}
