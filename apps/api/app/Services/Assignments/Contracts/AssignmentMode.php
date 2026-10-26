<?php

namespace App\Services\Assignments\Contracts;

use App\Models\Assignment;
use App\Services\Assignments\DTO\SubmissionContext;
use App\Services\Assignments\DTO\SubmissionResult;
use Illuminate\Http\Request;

interface AssignmentMode
{
    /**
     * Unique identifier for the mode.
     */
    public function mode(): string;

    /**
     * Additional validation rules for this mode.
     */
    public function rules(bool $isUpdate = false): array;

    /**
     * Allow the mode to mutate assignment payload before save.
     */
    public function prepareData(
        array $data,
        Request $request,
        bool $isUpdate = false,
        ?Assignment $assignment = null
    ): array;

    /**
     * Execute follow-up tasks once the assignment is saved.
     */
    public function afterSave(Assignment $assignment, Request $request, bool $isUpdate = false): void;

    /**
     * Handle student submission for this assignment mode.
     */
    public function handleSubmission(
        Request $request,
        Assignment $assignment,
        SubmissionContext $context
    ): SubmissionResult;

    /**
     * Append extra data to AssignmentResource output.
     */
    public function transformResource(Assignment $assignment, Request $request): ?array;

    /**
     * Validate payload when a submission is manually updated by staff.
     */
    public function validateSubmissionUpdate(array $payload, Assignment $assignment): void;
}
