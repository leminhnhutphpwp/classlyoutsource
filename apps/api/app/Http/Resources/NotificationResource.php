<?php

namespace App\Http\Resources;

use App\Models\ClassRoom;
use App\Models\Student;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class NotificationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = auth('api')->user();
        $userId = $user?->id;

        // Check if current user has read this notification
        $readStatus = null;
        if ($userId && $this->relationLoaded('reads')) {
            $readStatus = $this->reads->firstWhere('user_id', $userId);
        } elseif ($userId) {
            $readStatus = $this->getReadStatusFor($userId);
        }

        return [
            '_id' => $this->hash_id,
            'created_by' => $this->created_by ? User::encodeId((int) $this->created_by) : null,
            'title' => $this->title,
            'message' => $this->message,
            'type' => $this->type,
            'target' => $this->target,
            'recipient_type' => $this->recipient_type,
            'recipient_ids' => collect($this->recipient_ids ?? [])->map(fn ($id) => is_numeric($id) ? User::encodeId((int) $id) : $id)->toArray(),
            'recipient_classes' => collect($this->recipient_classes ?? [])->map(fn ($id) => is_numeric($id) ? ClassRoom::encodeId((int) $id) : $id)->toArray(),
            'recipient_students' => collect($this->recipient_students ?? [])->map(fn ($id) => is_numeric($id) ? Student::encodeId((int) $id) : $id)->toArray(),
            'channel' => $this->channel,
            'status' => $this->status,
            'status_label' => $this->getStatusLabel(),
            'scheduled_at' => $this->scheduled_at?->toISOString(),
            'sent_at' => $this->sent_at?->toISOString(),
            'sent_count' => $this->sent_count ?? 0,
            'failed_count' => $this->failed_count ?? 0,

            // Read status for current user
            'is_read' => $readStatus !== null,
            'read_at' => $readStatus?->read_at?->toISOString(),

            // Relationships
            'creator' => new UserResource($this->whenLoaded('creator')),

            // Timestamps
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }

    /**
     * Get status label in Vietnamese.
     */
    protected function getStatusLabel(): string
    {
        return match ($this->status) {
            'draft' => 'Bản nháp',
            'scheduled' => 'Đã lên lịch',
            'processing' => 'Đang xử lý',
            'sent' => 'Đã gửi',
            'failed' => 'Gửi thất bại',
            default => $this->status ?? 'N/A',
        };
    }
}
