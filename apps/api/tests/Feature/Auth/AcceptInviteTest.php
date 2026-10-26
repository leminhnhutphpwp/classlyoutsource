<?php

namespace Tests\Feature\Auth;

use App\Models\Student;
use App\Models\StudentInvite;
use App\Models\User;
use Illuminate\Support\Str;
use Tests\TestCase;

class AcceptInviteTest extends TestCase
{
    private function parentInvite(User $tutor, Student $student, array $overrides = []): array
    {
        $raw = Str::uuid()->toString();
        $invite = StudentInvite::create(array_merge([
            'user_id' => $tutor->id,
            'email' => 'parent-'.uniqid().'@example.com',
            'name' => 'Phụ huynh A',
            'role' => 'parent',
            'token' => hash('sha256', $raw),
            'status' => 'sent',
            'sent_at' => now(),
            'expires_at' => now()->addDays(7),
            'meta' => ['student_id' => $student->id],
        ], $overrides));

        return [$raw, $invite];
    }

    public function test_invalid_token_returns_410(): void
    {
        $this->getJson('/api/v1/auth/invite/nope')->assertStatus(410);
    }

    public function test_show_valid_invite(): void
    {
        $tutor = $this->tutor(['name' => 'Thầy B']);
        $student = Student::factory()->create(['created_by' => $tutor->id]);
        [$raw, $invite] = $this->parentInvite($tutor, $student);

        $this->getJson("/api/v1/auth/invite/{$raw}")
            ->assertStatus(200)
            ->assertJsonPath('data.role', 'parent')
            ->assertJsonPath('data.tutor_name', 'Thầy B');
    }

    public function test_accept_parent_invite_creates_account_links_guardian_and_logs_in(): void
    {
        $tutor = $this->tutor();
        $student = Student::factory()->create(['created_by' => $tutor->id]);
        [$raw, $invite] = $this->parentInvite($tutor, $student);

        $res = $this->postJson('/api/v1/auth/accept-invite', [
            'token' => $raw, 'password' => 'password123', 'password_confirmation' => 'password123',
        ])->assertStatus(200);

        $res->assertJsonPath('data.user.role', 'parent')->assertJsonStructure(['data' => ['token', 'refresh_token']]);
        $this->assertDatabaseHas('student_invites', ['id' => $invite->id, 'status' => 'accepted']);
        $parent = User::where('email', $invite->email)->firstOrFail();
        $this->assertDatabaseHas('guardian_student', ['user_id' => $parent->id, 'student_id' => $student->id, 'status' => 'active']);

        // The freshly-created parent can now access their child (guardStudentAccess parent branch).
        $this->actingAsApi($parent)
            ->getJson("/api/v1/payments/student/{$student->hash_id}")
            ->assertStatus(200);
    }

    public function test_accept_is_replay_safe(): void
    {
        $tutor = $this->tutor();
        $student = Student::factory()->create(['created_by' => $tutor->id]);
        [$raw] = $this->parentInvite($tutor, $student);

        $this->postJson('/api/v1/auth/accept-invite', ['token' => $raw, 'password' => 'password123', 'password_confirmation' => 'password123'])->assertStatus(200);
        // second use → invite is 'accepted', no longer 'sent'
        $this->postJson('/api/v1/auth/accept-invite', ['token' => $raw, 'password' => 'password123', 'password_confirmation' => 'password123'])->assertStatus(410);
    }

    public function test_expired_invite_rejected(): void
    {
        $tutor = $this->tutor();
        $student = Student::factory()->create(['created_by' => $tutor->id]);
        [$raw] = $this->parentInvite($tutor, $student, ['expires_at' => now()->subDay()]);

        $this->postJson('/api/v1/auth/accept-invite', ['token' => $raw, 'password' => 'password123', 'password_confirmation' => 'password123'])->assertStatus(410);
    }
}
