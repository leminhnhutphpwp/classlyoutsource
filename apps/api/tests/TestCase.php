<?php

namespace Tests;

use App\Models\ClassRoom;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\DB;
use Tymon\JWTAuth\Facades\JWTAuth;

abstract class TestCase extends BaseTestCase
{
    use RefreshDatabase;

    /**
     * Authenticate as the given user for the JWT 'api' guard, sending a real
     * bearer token so the AuthenticateApi middleware resolves it exactly as in prod.
     */
    protected function actingAsApi(User $user): static
    {
        // Mint a proper access token (typ=access) — matches production and pins the claim so a leaked
        // customClaims() from a prior request in the same test can't stamp this as typ=refresh.
        $token = JWTAuth::customClaims(['typ' => 'access'])->fromUser($user);
        $this->withHeader('Authorization', 'Bearer '.$token);
        $this->withHeader('Accept', 'application/json');
        $this->actingAs($user, 'api');

        return $this;
    }

    /** Create a tutor (data-owning tenant). */
    protected function tutor(array $attrs = []): User
    {
        return User::factory()->tutor()->create($attrs);
    }

    /** Create a student-role user. */
    protected function studentUser(array $attrs = []): User
    {
        return User::factory()->student()->create($attrs);
    }

    /** Create a parent (guardian) user. */
    protected function guardian(array $attrs = []): User
    {
        return User::factory()->parent()->create($attrs);
    }

    /** Link a parent user to a student via the guardian_student pivot (active). */
    protected function linkGuardian(User $parent, Student $student, bool $active = true): void
    {
        DB::table('guardian_student')->updateOrInsert(
            ['user_id' => $parent->id, 'student_id' => $student->id],
            ['status' => $active ? 'active' : 'revoked', 'is_primary' => true, 'updated_at' => now(), 'created_at' => now()],
        );
    }

    /** Enroll a student into a class via the class_student pivot (the real relationship). */
    protected function enroll(Student $student, ClassRoom $class): void
    {
        $student->classes()->syncWithoutDetaching([
            $class->id => ['status' => 'active', 'enrolled_at' => now()->toDateString()],
        ]);
    }

    /** Create a student and enroll them (pivot) into the given class. */
    protected function studentInClass(ClassRoom $class, array $attrs = []): Student
    {
        $student = Student::factory()->create(array_merge(['class_id' => $class->id], $attrs));
        $this->enroll($student, $class);

        return $student;
    }
}
