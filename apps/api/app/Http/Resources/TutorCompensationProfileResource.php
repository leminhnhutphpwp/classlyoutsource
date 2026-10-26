<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Shapes a tutor_compensation_profiles row (the pay RULE). Owner/manager only — member-tutors NEVER see
 * rate tables (design §2.4, §5 QĐ 8). Public ids are hashids; raw organization_id is not exposed.
 */
class TutorCompensationProfileResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            '_id' => $this->hash_id,
            'user_id' => $this->user_id ? User::encodeId($this->user_id) : null,
            'pay_model' => $this->pay_model,
            'base_salary' => $this->base_salary !== null ? (float) $this->base_salary : null,
            'rate_per_session' => $this->rate_per_session !== null ? (float) $this->rate_per_session : null,
            'rate_per_student' => $this->rate_per_student !== null ? (float) $this->rate_per_student : null,
            'revenue_share_pct' => $this->revenue_share_pct !== null ? (float) $this->revenue_share_pct : null,
            'components' => $this->components,
            'session_basis' => $this->session_basis,
            'currency' => $this->currency,
            'effective_from' => $this->effective_from?->toDateString(),
            'effective_to' => $this->effective_to?->toDateString(),
            'status' => $this->status,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
