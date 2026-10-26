<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Public shape of an OrganizationMember (roster row). User id is a hashid; email/name come from
 * the eager-loaded user when available. `activated` is derived from the USER (email verified = they
 * have set a password and can log in) — a freshly created center tutor is active-but-not-activated
 * until they follow the set-password email.
 */
class OrganizationMemberResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            '_id' => $this->hash_id,
            'user_id' => User::encodeId($this->user_id),
            'name' => $this->whenLoaded('user', fn () => $this->user?->name),
            'email' => $this->whenLoaded('user', fn () => $this->user?->email),
            'org_role' => $this->org_role,
            'status' => $this->status,
            'activated' => $this->whenLoaded('user', fn () => $this->user?->email_verified_at !== null),
            'joined_at' => $this->joined_at?->toISOString(),
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
