<?php

namespace Tests\Feature\Grades;

use App\Models\GradeType;
use Tests\TestCase;

/**
 * GradeType.weight now flows through the create/update API (previously ignored, so weight was always 1).
 * Weight feeds Grade::weightedAveragePercentage, so persisting it is what makes weighting real.
 */
class GradeTypeWeightTest extends TestCase
{
    public function test_create_persists_weight(): void
    {
        $tutor = $this->tutor();

        $this->actingAsApi($tutor)
            ->postJson('/api/v1/grade-types', [
                'name' => 'Cuối kỳ',
                'weight' => 2.5,
            ])
            ->assertStatus(201)
            ->assertJsonPath('data.weight', 2.5);

        $type = GradeType::where('created_by', $tutor->id)->firstOrFail();
        $this->assertEquals(2.5, (float) $type->weight);
    }

    public function test_create_defaults_weight_to_one_when_omitted(): void
    {
        $tutor = $this->tutor();

        $res = $this->actingAsApi($tutor)
            ->postJson('/api/v1/grade-types', ['name' => 'Quiz'])
            ->assertStatus(201);

        // JSON collapses 1.0 to 1, so compare loosely.
        $this->assertEquals(1.0, $res->json('data.weight'));

        $type = GradeType::where('created_by', $tutor->id)->firstOrFail();
        $this->assertEquals(1.0, (float) $type->weight);
    }

    public function test_update_persists_weight(): void
    {
        $tutor = $this->tutor();
        $type = GradeType::create([
            'created_by' => $tutor->id, 'name' => 'Giữa kỳ', 'weight' => 1, 'is_active' => true,
        ]);

        $this->actingAsApi($tutor)
            ->putJson("/api/v1/grade-types/{$type->hash_id}", ['weight' => 3.5])
            ->assertStatus(200)
            ->assertJsonPath('data.weight', 3.5);

        $this->assertEquals(3.5, (float) $type->fresh()->weight);
    }

    public function test_weight_must_be_numeric_and_within_range(): void
    {
        $tutor = $this->tutor();

        $this->actingAsApi($tutor)
            ->postJson('/api/v1/grade-types', ['name' => 'Bad', 'weight' => -1])
            ->assertStatus(422);

        $this->actingAsApi($tutor)
            ->postJson('/api/v1/grade-types', ['name' => 'Bad2', 'weight' => 'abc'])
            ->assertStatus(422);
    }
}
