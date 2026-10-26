<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Resources\Json\JsonResource;

class LoginActivityResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray($request): array
    {
        return [
            '_id' => $this->hash_id,
            'user_id' => $this->user_id ? User::encodeId($this->user_id) : null,
            'name' => $this->user->name ?? null,
            'phone' => $this->user->phone ?? null,
            'email' => $this->email,
            'is_success' => (bool) $this->is_success,
            'status' => $this->status,
            'message' => $this->message,
            'ip_address' => $this->ip_address,
            'device' => [
                '_id' => $this->device_id,
                'name' => $this->device_name,
                'location' => $this->location,
            ],
            'user_agent' => $this->user_agent,
            'context' => $this->context,
            'logged_in_at' => optional($this->logged_in_at)->toIso8601String(),
            'created_at' => optional($this->created_at)->toIso8601String(),
        ];
    }
}
