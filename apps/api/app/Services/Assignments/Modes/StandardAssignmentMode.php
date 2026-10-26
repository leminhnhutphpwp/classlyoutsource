<?php

namespace App\Services\Assignments\Modes;

use App\Models\Assignment;
use App\Models\Media;
use App\Models\Submission;
use App\Services\Assignments\Contracts\AssignmentMode;
use App\Services\Assignments\DTO\SubmissionContext;
use App\Services\Assignments\DTO\SubmissionResult;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class StandardAssignmentMode implements AssignmentMode
{
    public function mode(): string
    {
        return 'standard';
    }

    public function rules(bool $isUpdate = false): array
    {
        return [];
    }

    public function prepareData(
        array $data,
        Request $request,
        bool $isUpdate = false,
        ?Assignment $assignment = null
    ): array {
        $data['mode'] = 'standard';

        if (empty($data['allowed_submission_types'])) {
            $data['allowed_submission_types'] = ['text'];
        }

        $data['quiz_settings'] = null;

        return $data;
    }

    public function afterSave(Assignment $assignment, Request $request, bool $isUpdate = false): void
    {
        // Standard assignments don't require any post-processing.
    }

    public function handleSubmission(
        Request $request,
        Assignment $assignment,
        SubmissionContext $context
    ): SubmissionResult {
        $submissionType = $this->detectSubmissionType($request);
        if (! $submissionType) {
            throw ValidationException::withMessages([
                'submission' => ['Vui lòng cung cấp nội dung bài nộp (text, file, hoặc link).'],
            ]);
        }

        $validationMessage = $this->validateSubmissionType($submissionType, $assignment);
        if ($validationMessage) {
            throw ValidationException::withMessages([
                'submission' => [$validationMessage],
            ]);
        }

        $submission = Submission::create([
            'assignment_id' => $assignment->id,
            'student_id' => $context->student->id,
            'content' => $request->input('content'),
            'media_id' => $request->input('media_id'),
            'external_url' => $request->input('external_url'),
            'submitted_at' => now(),
            'is_late' => $context->isLate,
            'status' => 'pending',
            'attempt_number' => $context->attemptNumber,
            'submission_type' => $submissionType,
        ]);

        return new SubmissionResult(
            $submission,
            $this->buildSuccessMessage($context),
            201
        );
    }

    public function transformResource(Assignment $assignment, Request $request): ?array
    {
        return null;
    }

    public function validateSubmissionUpdate(array $payload, Assignment $assignment): void
    {
        if (empty(array_filter($payload))) {
            return;
        }

        $request = new Request($payload);
        $submissionType = $this->detectSubmissionType($request);

        if ($submissionType) {
            $validationMessage = $this->validateSubmissionType($submissionType, $assignment);
            if ($validationMessage) {
                throw ValidationException::withMessages([
                    'submission' => [$validationMessage],
                ]);
            }
        }
    }

    private function detectSubmissionType(Request $request): ?string
    {
        if ($request->filled('external_url')) {
            return 'link';
        }

        if ($request->filled('content') && ! $request->filled('media_id')) {
            $content = $request->input('content');
            if (preg_match('/https?:\/\/[^\s]+/', $content)) {
                return 'link';
            }

            return 'text';
        }

        if ($request->filled('media_id')) {
            $media = Media::find($request->input('media_id'));
            if ($media) {
                $mediaType = $media->type ?? 'document';

                return match ($mediaType) {
                    'image' => 'image',
                    'video' => 'video',
                    'audio' => 'audio',
                    default => $this->resolveFileType($media->ext ?? null),
                };
            }
        }

        if ($request->filled('content')) {
            return 'text';
        }

        return null;
    }

    private function resolveFileType(?string $extension): string
    {
        $ext = strtolower((string) $extension);

        $imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
        $videoExts = ['mp4', 'avi', 'mov', 'wmv', 'flv'];
        $audioExts = ['mp3', 'wav', 'ogg', 'm4a'];
        $documentExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf'];

        return match (true) {
            in_array($ext, $imageExts, true) => 'image',
            in_array($ext, $videoExts, true) => 'video',
            in_array($ext, $audioExts, true) => 'audio',
            in_array($ext, $documentExts, true) => 'document',
            default => 'file',
        };
    }

    private function validateSubmissionType(string $submissionType, Assignment $assignment): ?string
    {
        $allowedTypes = $assignment->getAllowedSubmissionTypes();

        if (! in_array($submissionType, $allowedTypes, true)) {
            $labels = [
                'text' => 'Văn bản',
                'file' => 'File',
                'document' => 'Tài liệu',
                'image' => 'Hình ảnh',
                'video' => 'Video',
                'audio' => 'Ghi âm',
                'link' => 'Liên kết',
            ];

            $allowedTypesStr = implode(', ', array_map(
                fn ($type) => $labels[$type] ?? $type,
                $allowedTypes
            ));

            return "Định dạng bài nộp không được phép. Bài tập này chỉ cho phép: {$allowedTypesStr}.";
        }

        return null;
    }

    private function buildSuccessMessage(SubmissionContext $context): string
    {
        $message = $context->attemptNumber === 1 ? 'Nộp bài thành công' : 'Nộp lại bài thành công';

        if ($context->maxAttempts !== null) {
            $remainingAttempts = max(0, $context->maxAttempts - $context->attemptNumber);
            if ($remainingAttempts > 0) {
                $message .= " (Lần {$context->attemptNumber}/{$context->maxAttempts}, còn {$remainingAttempts} lần)";
            } else {
                $message .= " (Lần {$context->attemptNumber}/{$context->maxAttempts}, đã đạt giới hạn)";
            }
        }

        return $message;
    }
}
