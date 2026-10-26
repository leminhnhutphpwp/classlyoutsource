<?php

namespace Tests\Feature\Students;

use App\Models\ClassRoom;
use App\Models\User;
use Tests\TestCase;

/**
 * Pausing/resuming a student's enrollment now records resumed_at on the class_student pivot (previously the
 * column was missing and the API always returned resumed_at=null).
 */
class PauseResumeTest extends TestCase
{
    private User $tutor;

    private ClassRoom $class;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tutor = $this->tutor();
        $this->class = ClassRoom::factory()->create(['tutor_id' => $this->tutor->id]);
    }

    private function pivot(int $studentId): object
    {
        return $this->class->students()->where('students.id', $studentId)->first()->pivot;
    }

    public function test_resume_records_resumed_at_and_pause_clears_it(): void
    {
        $student = $this->studentInClass($this->class);
        $base = "/api/v1/classes/{$this->class->hash_id}/students/{$student->hash_id}";

        $this->actingAsApi($this->tutor)->postJson("$base/pause", ['reason' => 'nghỉ ốm'])->assertOk();
        $paused = $this->pivot($student->id);
        $this->assertTrue((bool) $paused->is_paused);
        $this->assertNotNull($paused->paused_at);
        $this->assertNull($paused->resumed_at);

        $this->actingAsApi($this->tutor)->postJson("$base/resume")->assertOk();
        $resumed = $this->pivot($student->id);
        $this->assertFalse((bool) $resumed->is_paused);
        $this->assertNull($resumed->paused_at);
        $this->assertNotNull($resumed->resumed_at);

        // Pausing again clears the previous resume stamp.
        $this->actingAsApi($this->tutor)->postJson("$base/pause")->assertOk();
        $this->assertNull($this->pivot($student->id)->resumed_at);
    }
}
