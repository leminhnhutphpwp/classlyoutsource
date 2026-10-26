<?php

namespace Tests\Feature\Actions;

use App\Actions\ImportAttendanceAction;
use App\Models\ClassRoom;
use Tests\TestCase;

class ImportAttendanceActionTest extends TestCase
{
    /**
     * Regression guard for the drifted import resolver.
     *
     * The shared ResolvesImportEntities::findStudent() is HashID-aware. Before the
     * resolver was extracted, ImportAttendanceAction carried its own copy that did a
     * raw `where('id', $student_id)`, so a HashID identifier never matched and the row
     * failed with "student not found". This proves the attendance importer now resolves
     * a student supplied by public HashID.
     */
    public function test_import_attendance_resolves_student_by_hash_id(): void
    {
        $tutor = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $tutor->id, 'status' => 'active']);
        $student = $this->studentInClass($class);

        // Public HashID is exactly what a user would paste into an import file.
        $hashId = $student->hash_id;
        $this->assertFalse(is_numeric($hashId), 'HashID should be non-numeric to exercise the HashID branch.');

        $rows = [[
            'row_number' => 1,
            'data' => [
                'student_id' => $hashId,
                'class_id' => $class->id,
                'date' => now()->toDateString(),
                'status' => 'present',
            ],
        ]];

        $result = ImportAttendanceAction::execute($rows, $tutor->id);

        $this->assertSame(1, $result['success'], 'HashID student should resolve and import. Errors: '.json_encode($result['errors']));
        $this->assertSame(0, $result['failed']);

        // Attendance was written against the correct student — proving the resolution.
        $this->assertDatabaseHas('attendance', [
            'class_id' => $class->id,
            'student_id' => $student->id,
            'status' => 'present',
        ]);
    }
}
