<?php

namespace App\Http\Requests;

use App\Enums\OrgRole;
use Illuminate\Validation\Rule;

/**
 * Create a center-native staff account. The center provisions its OWN staff (name + email), so the
 * email must be brand new (the controller rejects any address already registered). org_role defaults
 * to 'tutor'; only an OWNER may create a manager OR an accountant (enforced in the controller — a
 * manager can create tutors only). owner is never assignable here. Never trusts organization_id from
 * the body — it comes from the route.
 */
class CreateOrganizationMemberRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255',
            'phone' => 'nullable|string|max:32',
            // manager | accountant | tutor — validated by the OrgRole enum (owner excluded).
            'org_role' => ['nullable', Rule::in(OrgRole::assignableValues())],
        ];
    }
}
