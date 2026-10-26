<?php

namespace App\Http\Requests;

use App\Models\Student;
use App\Models\User;
use App\Rules\ExistsHashId;

class SendNotificationEmailsRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'recipient_ids' => 'nullable|array',
            'recipient_ids.*' => [new ExistsHashId(User::class)],
            'recipient_student_ids' => 'nullable|array',
            'recipient_student_ids.*' => [new ExistsHashId(Student::class)],
            'channel' => 'nullable|in:email',
        ];
    }
}
