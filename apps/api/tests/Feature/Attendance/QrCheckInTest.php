<?php

namespace Tests\Feature\Attendance;

use App\Models\Attendance;
use App\Models\ClassRoom;
use App\Models\Schedule;
use App\Models\ScheduleSession;
use App\Models\Student;
use App\Models\User;
use Tests\TestCase;

/**
 * QR attendance: tutor opens a session (start → token+code), enrolled students self-check-in via token or
 * the fallback code, replay is idempotent, and non-enrolled/paused/expired attempts are rejected.
 */
class QrCheckInTest extends TestCase
{
    private User $tutor;

    private ClassRoom $class;

    private ScheduleSession $session;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tutor = $this->tutor();
        $this->class = ClassRoom::factory()->create(['tutor_id' => $this->tutor->id]);
        $this->session = $this->makeSession();
    }

    private function makeSession(array $attrs = []): ScheduleSession
    {
        $schedule = Schedule::factory()->create(['class_id' => $this->class->id]);

        return ScheduleSession::create(array_merge([
            'schedule_id' => $schedule->id,
            'class_id' => $this->class->id,
            'session_date' => now()->toDateString(),
            'start_time' => now()->format('H:i'),
            'end_time' => now()->addHour()->format('H:i'),
            'status' => 'scheduled',
        ], $attrs));
    }

    /** Enrolled student (with a login user), optionally paused. */
    private function enrolledStudent(bool $paused = false): array
    {
        $su = $this->studentUser();
        $student = $this->studentInClass($this->class, ['user_id' => $su->id]);
        if ($paused) {
            $student->classes()->updateExistingPivot($this->class->id, ['is_paused' => true]);
        }

        return [$su, $student];
    }

    private function start(): array
    {
        $res = $this->actingAsApi($this->tutor)
            ->postJson("/api/v1/schedule-sessions/{$this->session->hash_id}/attendance/start");
        $res->assertOk();

        return [$res->json('data.token'), $res->json('data.code')];
    }

    public function test_tutor_start_opens_session_and_issues_token(): void
    {
        [$token, $code] = $this->start();

        $this->assertNotEmpty($token);
        $this->assertSame(6, strlen($code));
        $this->assertSame('ongoing', $this->session->fresh()->status);
        $this->assertNotNull($this->session->fresh()->attendance_code);
    }

    public function test_enrolled_student_checks_in_with_token_and_replay_is_idempotent(): void
    {
        [$token] = $this->start();
        [$su, $student] = $this->enrolledStudent();

        $this->actingAsApi($su)->postJson('/api/v1/attendance/check-in', ['token' => $token])
            ->assertOk()->assertJsonPath('data.already_checked_in', false);

        $a = Attendance::where('student_id', $student->id)->first();
        $this->assertSame('present', $a->status);
        $this->assertSame('qr', $a->checked_in_via);
        $this->assertSame($this->session->id, $a->schedule_session_id);

        // Replay → no-op, still one row.
        $this->actingAsApi($su)->postJson('/api/v1/attendance/check-in', ['token' => $token])
            ->assertOk()->assertJsonPath('data.already_checked_in', true);
        $this->assertSame(1, Attendance::where('student_id', $student->id)->count());
    }

    public function test_expired_token_is_rejected(): void
    {
        [$token] = $this->start();
        [$su] = $this->enrolledStudent();

        $this->travel(2)->minutes(); // token TTL is 60s

        $this->actingAsApi($su)->postJson('/api/v1/attendance/check-in', ['token' => $token])
            ->assertStatus(410);
    }

    public function test_non_enrolled_student_is_rejected(): void
    {
        [$token] = $this->start();
        $outsider = $this->studentUser();
        Student::factory()->create(['user_id' => $outsider->id]); // exists but not enrolled

        $this->actingAsApi($outsider)->postJson('/api/v1/attendance/check-in', ['token' => $token])
            ->assertStatus(404);
    }

    public function test_paused_student_is_blocked(): void
    {
        [$token] = $this->start();
        [$su] = $this->enrolledStudent(paused: true);

        $this->actingAsApi($su)->postJson('/api/v1/attendance/check-in', ['token' => $token])
            ->assertStatus(422)->assertJsonPath('code', 'STUDENT_PAUSED');
    }

    public function test_code_fallback_works_and_wrong_code_rejected(): void
    {
        [, $code] = $this->start();
        [$su, $student] = $this->enrolledStudent();

        $this->actingAsApi($su)->postJson('/api/v1/attendance/check-in', [
            'code' => strtolower($code), // case-insensitive, no session id needed
        ])->assertOk();
        $this->assertSame('code', Attendance::where('student_id', $student->id)->first()->checked_in_via);

        [$su2] = $this->enrolledStudent();
        $this->actingAsApi($su2)->postJson('/api/v1/attendance/check-in', [
            'code' => 'ZZZZZZ',
        ])->assertStatus(422)->assertJsonPath('code', 'INVALID_CODE');
    }

    public function test_late_check_in_is_marked_late(): void
    {
        $this->session = $this->makeSession(['start_time' => now()->subMinutes(30)->format('H:i')]);
        [$token] = $this->start();
        [$su, $student] = $this->enrolledStudent();

        $this->actingAsApi($su)->postJson('/api/v1/attendance/check-in', ['token' => $token])->assertOk();
        $this->assertSame('late', Attendance::where('student_id', $student->id)->first()->status);
    }

    public function test_completing_session_clears_code_and_blocks_further_check_in(): void
    {
        [$token, $code] = $this->start();
        [$su] = $this->enrolledStudent();

        // Tutor closes the session — the fallback code is retired.
        $this->session->markAsCompleted($this->tutor->id);
        $this->assertNull($this->session->fresh()->attendance_code);

        // A token minted while the session was open no longer back-fills a closed session.
        $this->actingAsApi($su)->postJson('/api/v1/attendance/check-in', ['token' => $token])
            ->assertStatus(422)->assertJsonPath('code', 'SESSION_NOT_OPEN');

        // The old code is now dead (status no longer 'ongoing').
        [$su2] = $this->enrolledStudent();
        $this->actingAsApi($su2)->postJson('/api/v1/attendance/check-in', ['code' => $code])
            ->assertStatus(422)->assertJsonPath('code', 'INVALID_CODE');
    }

    public function test_cancelling_session_clears_code(): void
    {
        [, $code] = $this->start();

        $this->actingAsApi($this->tutor)
            ->postJson("/api/v1/schedule-sessions/{$this->session->hash_id}/cancel")
            ->assertOk();

        $this->assertNull($this->session->fresh()->attendance_code);
        $this->assertSame('cancelled', $this->session->fresh()->status);

        [$su] = $this->enrolledStudent();
        $this->actingAsApi($su)->postJson('/api/v1/attendance/check-in', ['code' => $code])
            ->assertStatus(422)->assertJsonPath('code', 'INVALID_CODE');
    }
}
