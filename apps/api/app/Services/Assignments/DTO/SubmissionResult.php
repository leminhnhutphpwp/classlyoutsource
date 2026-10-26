<?php

namespace App\Services\Assignments\DTO;

use App\Models\Submission;

class SubmissionResult
{
    public function __construct(
        public readonly Submission $submission,
        public readonly string $message,
        public readonly int $status = 201
    ) {}
}
