<?php

namespace Tests\Feature\Security;

use App\Models\ClassRoom;
use App\Models\Grade;
use App\Models\Media;
use App\Models\Student;
use App\Models\User;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Public ids must always leave the API as hashid STRINGS, never raw sequential integers.
 * These endpoints hand-build their response arrays (bypassing the Resource layer), so they are
 * guarded here to prevent a regression that re-leaks the raw DB primary keys / foreign keys.
 */
class IdRenderingTest extends TestCase
{
    /** Assert a value is a non-empty, non-numeric hashid string (optionally equal to $expected). */
    private function assertHashid($value, ?string $expected = null, string $context = ''): void
    {
        $this->assertIsString($value, "$context should be a string");
        $this->assertNotSame('', $value, "$context should not be empty");
        $this->assertFalse(is_numeric($value), "$context leaked a raw numeric id: {$value}");
        if ($expected !== null) {
            $this->assertSame($expected, $value, "$context is not the expected hashid");
        }
    }

    public function test_enroll_and_unenroll_responses_expose_hashids(): void
    {
        $tutor = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $tutor->id]);
        $student = Student::factory()->create(['class_id' => $class->id]);

        // Enroll: buildEnrollmentPayload
        $enrollResponse = $this->actingAsApi($tutor)
            ->postJson("/api/v1/classes/{$class->hash_id}/students", [
                'student_id' => $student->hash_id,
                'status' => 'active',
            ])
            ->assertStatus(201);

        $this->assertHashid(
            $enrollResponse->json('data.enrollment.student_id'),
            $student->hash_id,
            'enroll.enrollment.student_id'
        );
        $this->assertHashid(
            $enrollResponse->json('data.enrollment.class_id'),
            $class->hash_id,
            'enroll.enrollment.class_id'
        );

        // Unenroll response
        $unenrollResponse = $this->actingAsApi($tutor)
            ->deleteJson("/api/v1/classes/{$class->hash_id}/students/{$student->hash_id}")
            ->assertStatus(200);

        $this->assertHashid($unenrollResponse->json('data.student_id'), $student->hash_id, 'unenroll.student_id');
        $this->assertHashid($unenrollResponse->json('data.class_id'), $class->hash_id, 'unenroll.class_id');
    }

    public function test_student_classes_response_student_id_is_hashid(): void
    {
        $tutor = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $tutor->id]);
        $student = $this->studentInClass($class);

        $this->actingAsApi($tutor)
            ->getJson("/api/v1/students/{$student->hash_id}/classes")
            ->assertStatus(200)
            ->assertJsonPath('data.student_id', $student->hash_id);
    }

    public function test_student_grades_response_student_id_is_hashid(): void
    {
        $tutor = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $tutor->id]);
        $student = $this->studentInClass($class);
        Grade::factory()->create(['student_id' => $student->id, 'class_id' => $class->id, 'tutor_id' => $tutor->id]);

        $this->actingAsApi($tutor)
            ->getJson("/api/v1/students/{$student->hash_id}/grades")
            ->assertStatus(200)
            ->assertJsonPath('data.student_id', $student->hash_id);
    }

    public function test_media_status_accepts_hashid_and_returns_hashid(): void
    {
        Storage::fake('public');
        $tutor = $this->tutor();

        $path = 'media/sample_'.uniqid().'.jpg';
        Storage::disk('public')->put($path, 'fake-bytes');
        $media = Media::create([
            'disk' => 'public',
            'directory' => 'media',
            'visibility' => 'public',
            'name' => 'sample.jpg',
            'path' => $path,
            'type' => 'image',
            'ext' => 'jpg',
        ]);

        // Media public ids are encoded with the User salt (shared salt — see UserResource).
        $mediaHash = User::encodeId($media->id);

        // A raw-integer route param must NOT resolve (route now accepts a hashid only).
        $this->actingAsApi($tutor)
            ->getJson("/api/v1/media-optimization/{$media->id}/status")
            ->assertStatus(404);

        $this->actingAsApi($tutor)
            ->getJson("/api/v1/media-optimization/{$mediaHash}/status")
            ->assertStatus(200)
            ->assertJsonPath('data.media_id', $mediaHash);
    }
}
