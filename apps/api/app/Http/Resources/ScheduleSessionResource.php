<?php

namespace App\Http\Resources;

use App\Models\ClassRoom;
use App\Models\Schedule;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ScheduleSessionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            '_id' => $this->hash_id,
            'schedule_id' => Schedule::encodeId($this->schedule_id),
            'class_id' => ClassRoom::encodeId($this->class_id),
            'session_date' => $this->session_date?->toDateString(),
            'start_time' => $this->start_time?->format('H:i'),
            'end_time' => $this->end_time?->format('H:i'),
            'mode' => $this->mode,
            'room' => $this->room,
            'location' => $this->location,
            'online_platform' => $this->online_platform,
            'online_meeting_url' => $this->online_meeting_url,
            'online_meeting_id' => $this->online_meeting_id,
            'online_meeting_password' => $this->online_meeting_password,
            'status' => $this->status,
            'status_label' => $this->status_label,
            'status_color' => $this->status_color,
            'week_number' => $this->week_number,
            'notes' => $this->notes,

            // Completion info
            'completed_at' => $this->completed_at?->toISOString(),
            'completed_by' => $this->whenLoaded('completedBy', fn () => $this->completedBy ? new UserResource($this->completedBy) : null),
            'is_completed' => $this->isCompleted(),
            'is_manually_completed' => $this->isManuallyCompleted(),
            'is_auto_completed' => $this->isAutoCompleted(),

            // Time status
            'is_past' => $this->isPast(),
            'is_today' => $this->isToday(),
            'is_upcoming' => $this->isUpcoming(),

            // Relationships (only include if loaded)
            'schedule' => $this->whenLoaded('schedule', fn () => new ScheduleResource($this->schedule)),
            'class' => $this->whenLoaded('class', fn () => new ClassRoomResource($this->class)),

            // Timestamps
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
