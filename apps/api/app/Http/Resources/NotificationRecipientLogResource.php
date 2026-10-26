<?php

namespace App\Http\Resources;

use App\Models\Notification;
use App\Models\Student;
use App\Models\User;
use App\Models\UserNotificationPreference;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class NotificationRecipientLogResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            '_id' => $this->hash_id,
            'notification_id' => Notification::encodeId((int) $this->notification_id),
            'user_id' => $this->user_id ? User::encodeId((int) $this->user_id) : null,
            'student_id' => $this->student_id ? Student::encodeId((int) $this->student_id) : null,
            'user_name' => $this->user?->name,
            'student_name' => $this->student?->name,
            'student_code' => $this->student?->student_code,
            'email' => $this->email,
            'email_verified' => $this->user ? $this->user->hasVerifiedEmail() : (! empty($this->email)),
            'email_verified_at' => $this->user ? $this->user->email_verified_at : null,
            'phone' => $this->user?->phone ?? $this->student?->phone,
            'role_label' => $this->getRoleLabel(),
            'channel' => $this->channel,
            'status' => $this->status,
            'attempt' => $this->attempt,
            'sent_at' => $this->sent_at?->toISOString(),
            'error_message' => $this->error_message,
            'created_at' => $this->created_at?->toISOString(),
            'preference_enabled' => $this->user_id
                ? UserNotificationPreference::shouldSendNotification(
                    $this->user_id,
                    $this->notification->type ?? 'announcement'
                )
                : true,
        ];
    }

    protected function getRoleLabel(): string
    {
        if ($this->user) {
            return match ($this->user->role) {
                'super_admin' => 'Quản trị viên cấp cao',
                'admin' => 'Quản trị viên',
                'tutor' => 'Gia sư/Giáo viên',
                'student' => 'Học viên',
                'parent' => 'Phụ huynh',
                default => $this->user->role ?? 'N/A',
            };
        }

        if ($this->student) {
            return 'Học viên';
        }

        return 'N/A';
    }
}
