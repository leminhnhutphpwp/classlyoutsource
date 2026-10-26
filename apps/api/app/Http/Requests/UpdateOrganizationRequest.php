<?php

namespace App\Http\Requests;

/**
 * Update an organization's editable fields. owner_id / slug / status are NOT client-settable here.
 */
class UpdateOrganizationRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string|max:2000',
            'settings' => 'nullable|array',
        ];
    }
}
