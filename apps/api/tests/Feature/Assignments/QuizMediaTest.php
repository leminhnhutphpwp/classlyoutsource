<?php

namespace Tests\Feature\Assignments;

use App\Models\Assignment;
use App\Models\AssignmentQuestion;
use App\Models\Media;
use App\Services\AssignmentQuizService;
use App\Services\Assignments\Modes\QuizAssignmentMode;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

/**
 * Media attachments on quiz questions/options: audio prompt (English listening) or an image/diagram
 * (Math) on a question, and image answer choices on options. Media is optional — questions without
 * it must keep working (backward-compat).
 */
class QuizMediaTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        // Media's url accessor only returns a URL when the file exists on disk.
        Storage::fake('public');
    }

    private function media(string $type = 'image', string $ext = 'jpg'): Media
    {
        $path = 'media/sample_'.uniqid().'.'.$ext;
        Storage::disk('public')->put($path, 'fake-bytes');

        return Media::create([
            'disk' => 'public',
            'directory' => 'media',
            'visibility' => 'public',
            'name' => 'sample.'.$ext,
            'path' => $path,
            'type' => $type,
            'ext' => $ext,
        ]);
    }

    public function test_sync_persists_and_serializes_question_and_option_media(): void
    {
        $assignment = Assignment::factory()->create();
        $audio = $this->media('audio', 'mp3');   // listening prompt on the question
        $optionImage = $this->media('image', 'jpg'); // image answer choice

        AssignmentQuizService::syncQuestions($assignment, [
            [
                'question_type' => 'single_choice',
                'title' => 'Which sound did you hear?',
                'points' => 5,
                'media_id' => $audio->id,
                'options' => [
                    ['content' => 'A cat', 'is_correct' => true, 'media_id' => $optionImage->id],
                    ['content' => 'A dog', 'is_correct' => false],
                ],
            ],
        ]);

        // Persisted on the DB rows.
        $question = $assignment->questions()->with('options')->first();
        $this->assertSame($audio->id, $question->media_id);
        $this->assertSame($optionImage->id, $question->options->firstWhere('content', 'A cat')->media_id);

        // Serialized with a renderable URL + type for the FE.
        $assignment->load('questions.options', 'questions.media', 'questions.options.media');
        $payload = AssignmentQuizService::transformQuestions($assignment, true);

        $this->assertSame($audio->id, $payload[0]['media_id']);
        $this->assertSame('audio', $payload[0]['media']['type']);
        $this->assertNotEmpty($payload[0]['media']['url']);

        $optA = collect($payload[0]['options'])->firstWhere('content', 'A cat');
        $this->assertSame($optionImage->id, $optA['media_id']);
        $this->assertSame('image', $optA['media']['type']);
        $this->assertNotEmpty($optA['media']['url']);
    }

    public function test_questions_without_media_still_work(): void
    {
        $assignment = Assignment::factory()->create();

        AssignmentQuizService::syncQuestions($assignment, [
            [
                'question_type' => 'single_choice',
                'title' => 'Plain question',
                'points' => 3,
                'options' => [
                    ['content' => 'A', 'is_correct' => true],
                    ['content' => 'B', 'is_correct' => false],
                ],
            ],
        ]);

        $question = $assignment->questions()->first();
        $this->assertNull($question->media_id);

        $payload = AssignmentQuizService::transformQuestions($assignment, true);
        $this->assertNull($payload[0]['media_id']);
        $this->assertNull($payload[0]['media']);
        $this->assertNull($payload[0]['options'][0]['media_id']);
        $this->assertNull($payload[0]['options'][0]['media']);
    }

    public function test_validation_rejects_nonexistent_media_id(): void
    {
        $rules = (new QuizAssignmentMode)->rules();

        $payload = [
            'questions' => [[
                'title' => 'Q',
                'media_id' => 999999, // no such media row
                'options' => [
                    ['content' => 'A', 'is_correct' => true],
                    ['content' => 'B', 'is_correct' => false],
                ],
            ]],
        ];

        $validator = Validator::make($payload, $rules);
        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('questions.0.media_id', $validator->errors()->toArray());
    }

    public function test_validation_accepts_existing_media_id(): void
    {
        $media = $this->media();
        $rules = (new QuizAssignmentMode)->rules();

        $payload = [
            'questions' => [[
                'title' => 'Q',
                'media_id' => $media->id,
                'options' => [
                    ['content' => 'A', 'is_correct' => true, 'media_id' => $media->id],
                    ['content' => 'B', 'is_correct' => false],
                ],
            ]],
        ];

        $validator = Validator::make($payload, $rules);
        $this->assertFalse($validator->fails(), $validator->errors()->toJson());
    }

    public function test_media_set_null_on_delete_relationship(): void
    {
        // The belongsTo relation resolves the attached media (drives serialization).
        $assignment = Assignment::factory()->create();
        $image = $this->media('image', 'png');

        $question = $assignment->questions()->create([
            'question_type' => 'single_choice',
            'title' => 'Diagram question',
            'media_id' => $image->id,
            'points' => 1,
            'order' => 1,
        ]);

        $this->assertInstanceOf(Media::class, $question->fresh()->media);
        $this->assertSame($image->id, $question->fresh()->media->id);
    }

    public function test_sync_ignores_blank_media_id(): void
    {
        // An empty string from the FE (cleared picker) must not blow up exists/cast — treated as null.
        $assignment = Assignment::factory()->create();

        AssignmentQuizService::syncQuestions($assignment, [
            [
                'title' => 'Q',
                'media_id' => '',
                'options' => [
                    ['content' => 'A', 'is_correct' => true, 'media_id' => ''],
                    ['content' => 'B', 'is_correct' => false],
                ],
            ],
        ]);

        /** @var AssignmentQuestion $question */
        $question = $assignment->questions()->with('options')->first();
        $this->assertNull($question->media_id);
        $this->assertNull($question->options->first()->media_id);
    }
}
