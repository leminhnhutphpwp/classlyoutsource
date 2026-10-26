<?php

namespace Tests\Feature\Reports;

use App\Models\ClassRoom;
use App\Models\Schedule;
use App\Models\ScheduleSession;
use Tests\TestCase;

/**
 * Regression for the reports overview: total_sessions used to count the legacy, never-populated
 * ClassSession table (always ~0). It now counts real ScheduleSession rows (non-cancelled, in window).
 */
class ReportsSummaryTest extends TestCase
{
    private function makeSession(ClassRoom $class, Schedule $schedule, string $date, string $status): void
    {
        ScheduleSession::create([
            'schedule_id' => $schedule->id,
            'class_id' => $class->id,
            'session_date' => $date,
            'start_time' => '08:00',
            'end_time' => '09:30',
            'status' => $status,
        ]);
    }

    public function test_total_sessions_counts_real_non_cancelled_sessions_in_window(): void
    {
        $tutor = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $tutor->id]);
        $schedule = Schedule::factory()->create(['class_id' => $class->id]);

        $recent = now()->subDays(5)->toDateString();
        $old = now()->subDays(90)->toDateString();

        $this->makeSession($class, $schedule, $recent, 'completed');   // counted
        $this->makeSession($class, $schedule, now()->subDays(6)->toDateString(), 'scheduled'); // counted
        $this->makeSession($class, $schedule, now()->subDays(7)->toDateString(), 'cancelled'); // excluded (cancelled)
        $this->makeSession($class, $schedule, $old, 'completed');      // excluded (outside 30-day window)

        // Another tutor's session must not leak in (data isolation).
        $other = $this->tutor();
        $otherClass = ClassRoom::factory()->create(['tutor_id' => $other->id]);
        $otherSchedule = Schedule::factory()->create(['class_id' => $otherClass->id]);
        $this->makeSession($otherClass, $otherSchedule, $recent, 'completed');

        $response = $this->actingAsApi($tutor)->getJson('/api/v1/reports/overview');

        $response->assertOk();
        $this->assertSame(2, $response->json('data.summary.total_sessions'));
    }
}
