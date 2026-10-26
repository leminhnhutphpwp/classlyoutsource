<?php

namespace Tests\Feature\Api;

use App\Models\AiUsage;
use App\Models\Assignment;
use App\Models\ClassRoom;
use App\Models\Submission;
use App\Models\User;
use App\Services\AI\AiClient;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * AI Track A: grading + question generation endpoints. Every AI call is faked with Http::fake() —
 * we NEVER hit the real Anthropic API. Covers happy path, cost metering, refusal, rate-limit,
 * role/capability gating, ownership, and the AI-disabled fail-safe.
 */
class AiControllerTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        // AI on for most tests; a real key so AiClient doesn't short-circuit as disabled.
        config(['services.ai.enabled' => true, 'services.ai.default.key' => 'test-key']);
    }

    /** Build a tutor + owned class + assignment + a free-text submission. */
    private function ownedSubmission(User $tutor, array $subAttrs = []): Submission
    {
        $class = ClassRoom::factory()->create(['tutor_id' => $tutor->id]);
        $assignment = Assignment::factory()->create([
            'tutor_id' => $tutor->id,
            'class_id' => $class->id,
            'max_score' => 10,
        ]);

        return Submission::factory()->create(array_merge([
            'assignment_id' => $assignment->id,
            'content' => 'Thủ đô của Việt Nam là Hà Nội, một thành phố có bề dày lịch sử.',
            'status' => 'submitted',
            'score' => null,
            'graded_by' => null,
            'graded_at' => null,
        ], $subAttrs));
    }

    private function fakeMessages(array $json, int $status = 200, array $usage = ['input_tokens' => 120, 'output_tokens' => 40]): void
    {
        Http::fake([
            '*/v1/messages' => Http::response([
                'content' => [['type' => 'text', 'text' => json_encode($json)]],
                'stop_reason' => 'end_turn',
                'usage' => $usage,
            ], $status),
        ]);
    }

    public function test_ai_grade_stores_suggestion_and_records_usage(): void
    {
        $tutor = $this->tutor();
        $submission = $this->ownedSubmission($tutor);

        $this->fakeMessages([
            'score' => 8,
            'is_correct' => true,
            'feedback' => 'Bài làm tốt, nêu đúng ý chính. Cần bổ sung dẫn chứng.',
            'confidence' => 0.82,
            'criteria' => [
                ['name' => 'Nội dung', 'score' => 5, 'comment' => 'Đủ ý chính.'],
                ['name' => 'Dẫn chứng', 'score' => 3, 'comment' => 'Còn thiếu ví dụ.'],
            ],
        ]);

        $res = $this->actingAsApi($tutor)
            ->postJson("/api/v1/submissions/{$submission->hash_id}/ai-grade");

        $res->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.suggestion.score', 8)
            ->assertJsonPath('data.suggestion.is_correct', true)
            ->assertJsonPath('data.suggestion.confidence', 0.82)
            ->assertJsonPath('data.suggestion.criteria.0.name', 'Nội dung')
            ->assertJsonCount(2, 'data.suggestion.criteria');

        // Stored as a SUGGESTION — never the final score / graded_by.
        $submission->refresh();
        $this->assertEquals(8, (int) $submission->ai_suggested_score);
        $this->assertNotNull($submission->ai_feedback);
        $this->assertNull($submission->score);
        $this->assertNull($submission->graded_by);

        // The rubric + confidence are persisted too, so the review queue / result screen can
        // render them long after this HTTP response is gone (not just echoed in the payload).
        $this->assertEqualsWithDelta(0.82, (float) $submission->ai_confidence, 0.001);
        $this->assertIsArray($submission->ai_criteria);
        $this->assertCount(2, $submission->ai_criteria);
        $this->assertSame('Nội dung', $submission->ai_criteria[0]['name']);
        $this->assertSame(5, $submission->ai_criteria[0]['score']);

        // Cost metering row written with a computed cost.
        $usage = AiUsage::where('feature', 'grade')->first();
        $this->assertNotNull($usage);
        $this->assertEquals($tutor->id, $usage->user_id);
        $this->assertEquals(120, $usage->input_tokens);
        $this->assertGreaterThan(0, (float) $usage->estimated_cost);
    }

    public function test_ai_grade_clamps_score_to_max(): void
    {
        $tutor = $this->tutor();
        $submission = $this->ownedSubmission($tutor); // max_score 10

        $this->fakeMessages(['score' => 999, 'is_correct' => true, 'feedback' => 'ok']);

        $this->actingAsApi($tutor)
            ->postJson("/api/v1/submissions/{$submission->hash_id}/ai-grade")
            ->assertOk()
            ->assertJsonPath('data.suggestion.score', 10);
    }

    public function test_ai_grade_handles_refusal_cleanly(): void
    {
        $tutor = $this->tutor();
        $submission = $this->ownedSubmission($tutor);

        Http::fake([
            '*/v1/messages' => Http::response([
                'content' => [['type' => 'text', 'text' => '']],
                'stop_reason' => 'refusal',
                'usage' => ['input_tokens' => 10, 'output_tokens' => 0],
            ], 200),
        ]);

        $this->actingAsApi($tutor)
            ->postJson("/api/v1/submissions/{$submission->hash_id}/ai-grade")
            ->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('code', 'AI_REFUSAL');

        // No usage recorded when the call didn't produce a usable result.
        $this->assertEquals(0, AiUsage::count());
    }

    public function test_ai_grade_handles_rate_limit_gracefully(): void
    {
        config(['services.ai.max_retries' => 1]);
        $tutor = $this->tutor();
        $submission = $this->ownedSubmission($tutor);

        Http::fake([
            '*/v1/messages' => Http::response(['error' => ['message' => 'rate limited']], 429),
        ]);

        $this->actingAsApi($tutor)
            ->postJson("/api/v1/submissions/{$submission->hash_id}/ai-grade")
            ->assertStatus(429)
            ->assertJsonPath('code', 'AI_RATE_LIMITED');
    }

    public function test_ai_disabled_returns_clear_error(): void
    {
        config(['services.ai.enabled' => false]);
        $tutor = $this->tutor();
        $submission = $this->ownedSubmission($tutor);
        Http::fake(); // must NOT be called

        $this->actingAsApi($tutor)
            ->postJson("/api/v1/submissions/{$submission->hash_id}/ai-grade")
            ->assertStatus(503)
            ->assertJsonPath('code', 'AI_DISABLED');

        Http::assertNothingSent();
    }

    public function test_ai_grade_non_owner_is_404(): void
    {
        $owner = $this->tutor();
        $other = $this->tutor();
        $submission = $this->ownedSubmission($owner);
        Http::fake();

        $this->actingAsApi($other)
            ->postJson("/api/v1/submissions/{$submission->hash_id}/ai-grade")
            ->assertStatus(404);

        Http::assertNothingSent();
    }

    public function test_ai_generate_returns_questions_in_shape(): void
    {
        $tutor = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $tutor->id]);
        $assignment = Assignment::factory()->create(['tutor_id' => $tutor->id, 'class_id' => $class->id]);

        $this->fakeMessages([
            'questions' => [
                [
                    'question_type' => 'single_choice',
                    'title' => '2 + 2 = ?',
                    'points' => 1,
                    'explanation' => 'Vì 2 cộng 2 bằng 4.',
                    'options' => [
                        ['content' => '3', 'is_correct' => false, 'feedback' => ''],
                        ['content' => '4', 'is_correct' => true, 'feedback' => 'Chính xác'],
                        ['content' => '5', 'is_correct' => false, 'feedback' => ''],
                        ['content' => '6', 'is_correct' => false, 'feedback' => ''],
                    ],
                ],
            ],
        ]);

        $res = $this->actingAsApi($tutor)->postJson(
            "/api/v1/assignments/{$assignment->hash_id}/ai-generate-questions",
            ['topic' => 'Phép cộng cơ bản', 'count' => 1, 'question_type' => 'single_choice']
        );

        $res->assertOk()
            ->assertJsonPath('data.count', 1)
            ->assertJsonPath('data.questions.0.question_type', 'single_choice')
            ->assertJsonPath('data.questions.0.title', '2 + 2 = ?')
            ->assertJsonPath('data.questions.0.points', 1)
            ->assertJsonPath('data.questions.0.options.1.is_correct', true);

        $this->assertEquals(1, AiUsage::where('feature', 'generate')->count());
    }

    public function test_ai_request_uses_structured_outputs_and_headers(): void
    {
        $tutor = $this->tutor();
        $submission = $this->ownedSubmission($tutor);
        config(['services.ai.features.grade.model' => 'claude-haiku-4-5']);

        $this->fakeMessages(['score' => 5, 'is_correct' => true, 'feedback' => 'ok']);

        $this->actingAsApi($tutor)
            ->postJson("/api/v1/submissions/{$submission->hash_id}/ai-grade")
            ->assertOk();

        Http::assertSent(function ($request) {
            $body = $request->data();

            return str_ends_with($request->url(), '/v1/messages')
                && $request->hasHeader('x-api-key', 'test-key')
                && $request->hasHeader('anthropic-version', '2023-06-01')
                // Grading runs on the cheap per-feature model, not the generic default.
                && $body['model'] === 'claude-haiku-4-5'
                && ($body['output_config']['format']['type'] ?? null) === 'json_schema'
                && ($body['output_config']['format']['schema']['additionalProperties'] ?? null) === false
                && ($body['messages'][0]['role'] ?? null) === 'user';
        });
    }

    public function test_ai_grade_uses_cheap_grade_model(): void
    {
        config(['services.ai.features.grade.model' => 'claude-haiku-4-5']);
        $tutor = $this->tutor();
        $submission = $this->ownedSubmission($tutor);

        $this->fakeMessages(['score' => 5, 'is_correct' => true, 'feedback' => 'ok']);

        $this->actingAsApi($tutor)
            ->postJson("/api/v1/submissions/{$submission->hash_id}/ai-grade")
            ->assertOk();

        // Metering row records the actual (cheap) model used.
        $this->assertEquals('claude-haiku-4-5', AiUsage::where('feature', 'grade')->value('model'));
    }

    public function test_ai_generate_uses_sonnet_model_without_thinking(): void
    {
        config(['services.ai.features.generate.model' => 'claude-sonnet-5']);
        $tutor = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $tutor->id]);
        $assignment = Assignment::factory()->create(['tutor_id' => $tutor->id, 'class_id' => $class->id]);

        $this->fakeMessages(['questions' => [[
            'question_type' => 'single_choice',
            'title' => '2 + 2 = ?',
            'points' => 1,
            'explanation' => '',
            'options' => [
                ['content' => '4', 'is_correct' => true, 'feedback' => ''],
                ['content' => '5', 'is_correct' => false, 'feedback' => ''],
            ],
        ]]]);

        $this->actingAsApi($tutor)->postJson(
            "/api/v1/assignments/{$assignment->hash_id}/ai-generate-questions",
            ['topic' => 'Phép cộng', 'count' => 1, 'question_type' => 'single_choice']
        )->assertOk();

        Http::assertSent(function ($request) {
            $body = $request->data();

            return str_ends_with($request->url(), '/v1/messages')
                && $body['model'] === 'claude-sonnet-5'
                // `thinking` was removed to cut output-token cost.
                && ! array_key_exists('thinking', $body);
        });

        $this->assertEquals('claude-sonnet-5', AiUsage::where('feature', 'generate')->value('model'));
    }

    public function test_ai_grade_uses_openai_transport_when_feature_type_is_openai(): void
    {
        // Point the grade feature at an OpenAI-compatible endpoint — config only, no code change.
        config([
            'services.ai.features.grade.type' => 'openai',
            'services.ai.features.grade.base_url' => 'https://api.openai.com',
            'services.ai.features.grade.model' => 'gpt-4o-mini',
            'services.ai.features.grade.key' => 'sk-test',
        ]);

        $tutor = $this->tutor();
        $submission = $this->ownedSubmission($tutor);

        Http::fake([
            '*/chat/completions' => Http::response([
                'choices' => [[
                    'message' => [
                        'role' => 'assistant',
                        'content' => json_encode([
                            'score' => 7,
                            'is_correct' => true,
                            'feedback' => 'Bài ổn, cần thêm dẫn chứng.',
                            'confidence' => 0.7,
                            'criteria' => [],
                        ]),
                        'refusal' => null,
                    ],
                    'finish_reason' => 'stop',
                ]],
                'usage' => ['prompt_tokens' => 200, 'completion_tokens' => 60],
            ], 200),
        ]);

        $this->actingAsApi($tutor)
            ->postJson("/api/v1/submissions/{$submission->hash_id}/ai-grade")
            ->assertOk()
            ->assertJsonPath('data.suggestion.score', 7)
            ->assertJsonPath('data.suggestion.is_correct', true);

        // Request went to Chat Completions with Bearer auth + json_schema response_format.
        Http::assertSent(function ($request) {
            $body = $request->data();

            return str_ends_with($request->url(), '/v1/chat/completions')
                && $request->hasHeader('Authorization', 'Bearer sk-test')
                && ($body['model'] ?? null) === 'gpt-4o-mini'
                && ($body['response_format']['type'] ?? null) === 'json_schema'
                && ($body['response_format']['json_schema']['strict'] ?? null) === true
                && ($body['response_format']['json_schema']['schema']['additionalProperties'] ?? null) === false
                && ($body['messages'][0]['role'] ?? null) === 'system'
                && ($body['messages'][1]['role'] ?? null) === 'user'
                // No anthropic-only knobs leak into the openai request.
                && ! array_key_exists('thinking', $body)
                && ! array_key_exists('output_config', $body);
        });

        // Metering reads openai's prompt_tokens/completion_tokens and the resolved model.
        $usage = AiUsage::where('feature', 'grade')->first();
        $this->assertNotNull($usage);
        $this->assertEquals('gpt-4o-mini', $usage->model);
        $this->assertEquals(200, $usage->input_tokens);
        $this->assertEquals(60, $usage->output_tokens);
        $this->assertGreaterThan(0, (float) $usage->estimated_cost);
    }

    public function test_openai_transport_maps_refusal_and_invalid_response(): void
    {
        config([
            'services.ai.features.grade.type' => 'openai',
            'services.ai.features.grade.base_url' => 'https://api.openai.com',
            'services.ai.features.grade.model' => 'gpt-4o-mini',
            'services.ai.features.grade.key' => 'sk-test',
        ]);

        $tutor = $this->tutor();
        $submission = $this->ownedSubmission($tutor);

        // A populated `refusal` field maps to AI_REFUSAL (same as anthropic stop_reason=refusal).
        Http::fake([
            '*/chat/completions' => Http::response([
                'choices' => [[
                    'message' => ['content' => null, 'refusal' => 'Xin lỗi, tôi không thể.'],
                    'finish_reason' => 'stop',
                ]],
                'usage' => ['prompt_tokens' => 10, 'completion_tokens' => 0],
            ], 200),
        ]);

        $this->actingAsApi($tutor)
            ->postJson("/api/v1/submissions/{$submission->hash_id}/ai-grade")
            ->assertStatus(422)
            ->assertJsonPath('code', 'AI_REFUSAL');

        $this->assertEquals(0, AiUsage::count());
    }

    public function test_provider_resolution_falls_back_to_default_for_unset_fields(): void
    {
        // Default provider is an openai gateway; the grade feature overrides only the model and
        // leaves type/base_url/key unset → they must be inherited from `default`.
        config([
            'services.ai.default.type' => 'openai',
            'services.ai.default.base_url' => 'https://gateway.example.com/',
            'services.ai.default.key' => 'sk-default',
            'services.ai.features.grade.type' => null,
            'services.ai.features.grade.base_url' => null,
            'services.ai.features.grade.key' => null,
            'services.ai.features.grade.model' => 'custom-grader',
        ]);

        $provider = app(AiClient::class)->resolveProvider('grade');

        $this->assertSame('openai', $provider['type']);          // inherited
        $this->assertSame('https://gateway.example.com', $provider['base_url']); // inherited + trailing slash trimmed
        $this->assertSame('sk-default', $provider['key']);       // inherited
        $this->assertSame('custom-grader', $provider['model']);  // feature override wins
    }

    public function test_ai_generate_validates_count(): void
    {
        $tutor = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $tutor->id]);
        $assignment = Assignment::factory()->create(['tutor_id' => $tutor->id, 'class_id' => $class->id]);
        Http::fake();

        $this->actingAsApi($tutor)->postJson(
            "/api/v1/assignments/{$assignment->hash_id}/ai-generate-questions",
            ['topic' => 'x', 'count' => 50, 'question_type' => 'single_choice']
        )->assertStatus(422)->assertJsonPath('code', 'VALIDATION_ERROR');

        Http::assertNothingSent();
    }

    public function test_ai_generate_non_owner_is_404(): void
    {
        $owner = $this->tutor();
        $other = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $owner->id]);
        $assignment = Assignment::factory()->create(['tutor_id' => $owner->id, 'class_id' => $class->id]);
        Http::fake();

        $this->actingAsApi($other)->postJson(
            "/api/v1/assignments/{$assignment->hash_id}/ai-generate-questions",
            ['topic' => 'x', 'count' => 3, 'question_type' => 'single_choice']
        )->assertStatus(404);

        Http::assertNothingSent();
    }

    /** Stamp a stored AI suggestion onto a submission (as if ai-grade had already run). */
    private function withSuggestion(Submission $submission, float $score = 7, string $feedback = 'Gợi ý AI: bài làm khá.'): Submission
    {
        $submission->update([
            'ai_suggested_score' => $score,
            'ai_feedback' => $feedback,
            'ai_graded_at' => now(),
        ]);

        return $submission;
    }

    public function test_ai_accept_promotes_suggestion_to_official_grade(): void
    {
        $tutor = $this->tutor();
        $submission = $this->withSuggestion($this->ownedSubmission($tutor), 7);

        $res = $this->actingAsApi($tutor)
            ->postJson("/api/v1/submissions/{$submission->hash_id}/ai-grade/accept");

        $res->assertOk()->assertJsonPath('success', true);

        $submission->refresh();
        $this->assertEquals(7, (float) $submission->score);
        $this->assertEquals($tutor->id, $submission->graded_by);
        $this->assertEquals('graded', $submission->status);
        $this->assertNotNull($submission->graded_at);
    }

    public function test_ai_accept_without_suggestion_is_422(): void
    {
        $tutor = $this->tutor();
        $submission = $this->ownedSubmission($tutor); // no ai_graded_at

        $this->actingAsApi($tutor)
            ->postJson("/api/v1/submissions/{$submission->hash_id}/ai-grade/accept")
            ->assertStatus(422)
            ->assertJsonPath('code', 'AI_NO_SUGGESTION');

        $this->assertNull($submission->fresh()->score);
    }

    public function test_ai_accept_non_owner_is_404(): void
    {
        $owner = $this->tutor();
        $other = $this->tutor();
        $submission = $this->withSuggestion($this->ownedSubmission($owner), 7);

        $this->actingAsApi($other)
            ->postJson("/api/v1/submissions/{$submission->hash_id}/ai-grade/accept")
            ->assertStatus(404);
    }

    public function test_ai_accept_override_score_above_max_is_422(): void
    {
        $tutor = $this->tutor();
        $submission = $this->withSuggestion($this->ownedSubmission($tutor), 8); // max_score 10

        $this->actingAsApi($tutor)
            ->postJson("/api/v1/submissions/{$submission->hash_id}/ai-grade/accept", ['score' => 999])
            ->assertStatus(422)
            ->assertJsonPath('code', 'VALIDATION_ERROR');

        $this->assertNull($submission->fresh()->score);
    }
}
