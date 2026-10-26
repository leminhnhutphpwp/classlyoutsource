<?php

namespace App\Http\Controllers\API\V1;

use App\Models\ClassRoom;
use App\Rules\ExistsHashId;
use App\Services\ReminderService;
use App\Traits\DecodesHashIds;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReminderController extends BaseController
{
    use DecodesHashIds;

    protected ReminderService $reminderService;

    public function __construct(ReminderService $reminderService)
    {
        $this->reminderService = $reminderService;
    }

    /**
     * Get reminders for the authenticated user.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Check permission: user must have view_reminder permission
        // This permission is granted via capabilities (reminders.use)
        if ($planError = $this->requirePlanCapability('reminders.use')) {
            return $planError;
        }

        // Validate query parameters
        $validated = $request->validate([
            'type' => 'sometimes|in:schedule,payment,assignment,all',
            'limit' => 'sometimes|integer|min:1|max:50',
            'page' => 'sometimes|integer|min:1',
            'days_ahead' => 'sometimes|integer|min:1|max:30',
            'class_id' => ['sometimes', new ExistsHashId(ClassRoom::class)],
        ]);

        // Decode class_id if present
        $this->decodeHashId($validated, 'class_id', ClassRoom::class);

        $options = [
            'type' => $validated['type'] ?? 'all',
            'limit' => $validated['limit'] ?? 20,
            'page' => $validated['page'] ?? 1,
            'days_ahead' => $validated['days_ahead'] ?? 7,
            'class_id' => $validated['class_id'] ?? null,
        ];

        // Get reminders
        $result = $this->reminderService->getRemindersForUser($user, $options);

        // Determine user type
        $userType = $user->isTutor() ? 'tutor' : ($user->isStudent() ? 'student' : 'other');

        return $this->successResponse([
            'user_type' => $userType,
            'items' => $result['items'] ?? [],
            'summary' => $result['summary'],
            'meta' => $result['meta'],
        ]);
    }
}
