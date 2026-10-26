<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GradeTypeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            '_id' => $this->hash_id,
            'name' => $this->name,
            'code' => $this->code,
            'description' => $this->description,
            'is_active' => $this->is_active,
            'weight' => $this->weight !== null ? (float) $this->weight : null,
            'order' => $this->order,
            'created_by' => $this->created_by ? User::encodeId($this->created_by) : null,
            'display_name' => $this->display_name, // name + code formatted

            // Relationships (when loaded)
            'creator' => $this->whenLoaded('creator', fn () => new UserResource($this->creator)),

            // Timestamps
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
