<?php

namespace App\Services\Assignments;

use App\Models\Assignment;
use App\Services\Assignments\DTO\SubmissionContext;
use App\Services\Assignments\DTO\SubmissionResult;
use Illuminate\Http\Request;

class AssignmentWorkflowService
{
    public function __construct(private readonly AssignmentModeManager $manager) {}

    public function rulesForRequest(
        Request $request,
        bool $isUpdate = false,
        ?Assignment $assignment = null
    ): array {
        return $this->manager->modeFromRequest($request, $assignment)->rules($isUpdate);
    }

    public function prepareAssignmentData(
        Request $request,
        array $baseData,
        bool $isUpdate = false,
        ?Assignment $assignment = null
    ): array {
        return $this->manager
            ->modeFromRequest($request, $assignment)
            ->prepareData($baseData, $request, $isUpdate, $assignment);
    }

    public function afterSave(Assignment $assignment, Request $request, bool $isUpdate = false): void
    {
        $this->manager
            ->modeFromAssignment($assignment)
            ->afterSave($assignment, $request, $isUpdate);
    }

    public function handleSubmission(
        Request $request,
        Assignment $assignment,
        SubmissionContext $context
    ): SubmissionResult {
        return $this->manager
            ->modeFromAssignment($assignment)
            ->handleSubmission($request, $assignment, $context);
    }

    public function transformAssignmentResource(Assignment $assignment, Request $request): ?array
    {
        return $this->manager
            ->modeFromAssignment($assignment)
            ->transformResource($assignment, $request);
    }

    public function validateSubmissionUpdate(array $payload, Assignment $assignment): void
    {
        $this->manager
            ->modeFromAssignment($assignment)
            ->validateSubmissionUpdate($payload, $assignment);
    }
}
