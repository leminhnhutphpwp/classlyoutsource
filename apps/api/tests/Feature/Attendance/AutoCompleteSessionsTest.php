<?php

namespace Tests\Feature\Attendance;

use App\Models\ClassRoom;
use App\Models\Schedule;
use App\Models\ScheduleSession;
use Tests\TestCase;

/**
 * The sessions:auto-complete scheduled command closes any still-open session whose end time has passed and
 * retires its QR attendance_code — so a session opened for QR check-in but never manually completed can't
 * keep a live code that a student re-uses on a later day (Finding #6 root-cause fix).
 */
class AutoCompleteSessionsTest extends TestCase
{
    private function makeSession(array $attrs): ScheduleSession
    {
        $class = ClassRoom::factory()->create();
        $schedule = Schedule::factory()->create(['class_id' => $class->id]);

        return ScheduleSession::create(array_merge([
            'schedule_id' => $schedule->id,
            'class_id' => $class->id,
            'start_time' => '08:00',
            'end_time' => '09:00',
            'status' => 'ongoing',
            'attendance_code' => 'ABC123',
        ], $attrs));
    }

    public function test_it_closes_a_past_open_session_and_clears_the_code(): void
    {
        $session = $this->makeSession(['session_date' => now()->subDay()->toDateString()]);

        $this->artisan('sessions:auto-complete')->assertSuccessful();

        $session->refresh();
        $this->assertSame('completed', $session->status);
        $this->assertNull($session->attendance_code);
    }

    public function test_it_leaves_a_session_that_has_not_ended_yet(): void
    {
        $session = $this->makeSession([
            'session_date' => now()->toDateString(),
            'start_time' => now()->addHour()->format('H:i'),
            'end_time' => now()->addHours(2)->format('H:i'),
        ]);

        $this->artisan('sessions:auto-complete')->assertSuccessful();

        $session->refresh();
        $this->assertSame('ongoing', $session->status);
        $this->assertSame('ABC123', $session->attendance_code);
    }

    public function test_it_does_not_touch_completed_or_cancelled_sessions(): void
    {
        $completed = $this->makeSession([
            'session_date' => now()->subDay()->toDateString(),
            'status' => 'completed',
            'attendance_code' => null,
        ]);
        $cancelled = $this->makeSession([
            'session_date' => now()->subDay()->toDateString(),
            'status' => 'cancelled',
            'attendance_code' => null,
        ]);

        $this->artisan('sessions:auto-complete')->assertSuccessful();

        $this->assertSame('completed', $completed->refresh()->status);
        $this->assertSame('cancelled', $cancelled->refresh()->status);
    }
}
