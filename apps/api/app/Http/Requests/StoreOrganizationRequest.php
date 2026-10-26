<?php

namespace App\Http\Requests;

/**
 * Create an organization. owner_id / status / slug are derived server-side (never from input).
 */
class StoreOrganizationRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:2000',
            'settings' => 'nullable|array',
        ];
    }
}
