<?php

namespace App\Http\Requests;

class ImportGradesRequest extends ApiFormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true; // Authorization handled in controller
    }

    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        return [
            'file' => 'required|file|mimes:csv,xlsx,xls|max:10240', // Max 10MB
            'override_existing' => 'nullable|boolean',
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'file.required' => 'Vui lòng chọn file để import.',
            'file.file' => 'File không hợp lệ.',
            'file.mimes' => 'File phải có định dạng CSV hoặc Excel (XLSX/XLS).',
            'file.max' => 'Kích thước file không được vượt quá 10MB.',
            'override_existing.boolean' => 'Giá trị override_existing phải là true hoặc false.',
        ];
    }
}
