<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Public shape of an Organization. Never leaks raw numeric ids — the owner is a hashid and
 * internal columns (logo_media_id, deleted_at) stay out of the payload.
 */
class OrganizationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            '_id' => $this->hash_id,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'settings' => $this->settings,
            'status' => $this->status,
            'owner_id' => User::encodeId($this->owner_id),
            // The caller's own role in this org (set by the controller when known).
            'my_role' => $this->when(isset($this->my_role), fn () => $this->my_role),
            'members' => OrganizationMemberResource::collection($this->whenLoaded('members')),
            'members_count' => $this->when(isset($this->members_count), fn () => (int) $this->members_count),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
