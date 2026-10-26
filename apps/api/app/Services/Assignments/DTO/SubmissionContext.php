<?php

namespace App\Services\Assignments\DTO;

use App\Models\Student;
use App\Models\User;

class SubmissionContext
{
    public function __construct(
        public readonly Student $student,
        public readonly User $user,
        public readonly bool $isLate,
        public readonly int $attemptNumber,
        public readonly ?int $maxAttempts,
        public readonly int $existingAttempts
    ) {}
}
