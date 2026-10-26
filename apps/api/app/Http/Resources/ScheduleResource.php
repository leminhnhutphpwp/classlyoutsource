<?php

namespace App\Http\Resources;

use App\Models\ClassRoom;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ScheduleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            '_id' => $this->hash_id,
            'class_id' => ClassRoom::encodeId($this->class_id),
            'day_of_week' => $this->day_of_week,
            'day_name' => $this->day_name,
            'start_time' => $this->start_time?->format('H:i'),
            'end_time' => $this->end_time?->format('H:i'),
            'time_range' => $this->time_range,
            'duration' => $this->duration,
            'room' => $this->room,
            'location' => $this->location,
            'notes' => $this->notes,
            'is_active' => $this->is_active,

            // Status fields
            'status' => $this->status,
            'status_label' => $this->status_label,
            'status_color' => $this->status_color,
            'has_started' => $this->hasStarted(),
            'has_ended' => $this->hasEnded(),
            'is_in_progress' => $this->isInProgress(),
            'is_upcoming' => $this->isUpcoming(),
            'is_completed' => $this->isCompleted(),
            'is_paused' => $this->isPaused(),

            // Recurring fields
            'recurring_type' => $this->recurring_type,
            'recurring_days' => $this->recurring_days,
            'start_date' => $this->start_date?->toDateString(),
            'end_date' => $this->end_date?->toDateString(),

            // Online/Offline
            'default_mode' => $this->default_mode,
            'online_platform' => $this->online_platform,
            'online_meeting_url' => $this->online_meeting_url,
            'online_meeting_id' => $this->online_meeting_id,
            'online_meeting_password' => $this->online_meeting_password,
            'online_config' => $this->online_config,

            // Alternating pattern
            'is_alternating' => $this->is_alternating,
            'alternating_pattern' => $this->alternating_pattern,

            // Relationships
            'class' => new ClassRoomResource($this->whenLoaded('class')),

            // Timestamps
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
