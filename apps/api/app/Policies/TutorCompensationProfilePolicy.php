<?php

namespace App\Policies;

use App\Models\TutorCompensationProfile;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * The pay RULE per member. Sensitive center finance — only super_admin / admin may inspect it in the
 * admin interface; tutors/students never reach it. Read-only there: editing a rule in-place would silently
 * change how a member is paid; changes belong to the in-app org workflow (new profile + effective window).
 */
class TutorCompensationProfilePolicy
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

    public function view(User $user, TutorCompensationProfile $tutorCompensationProfile): bool
    {
        return $this->isBackOffice($user);
    }

    public function create(User $user): bool
    {
        return false;
    }

    public function update(User $user, TutorCompensationProfile $tutorCompensationProfile): bool
    {
        return false;
    }

    public function delete(User $user, TutorCompensationProfile $tutorCompensationProfile): bool
    {
        return false;
    }

    public function deleteAny(User $user): bool
    {
        return false;
    }

    public function restore(User $user, TutorCompensationProfile $tutorCompensationProfile): bool
    {
        return false;
    }

    public function forceDelete(User $user, TutorCompensationProfile $tutorCompensationProfile): bool
    {
        return false;
    }
}
