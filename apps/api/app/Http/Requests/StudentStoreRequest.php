<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class StudentStoreRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'student_code' => ['nullable', 'string', 'max:50', Rule::unique('students', 'student_code')->whereNull('deleted_at')],
            'parent_name' => ['nullable', 'string', 'max:255'],
            'phone' => [
                'nullable',
                'string',
                'max:20',
                Rule::unique('students', 'phone')->whereNull('deleted_at'),
                Rule::unique('users', 'phone')->whereNull('deleted_at'),
            ],
            // Required: store() always creates a login User (password is required), and users.email is
            // NOT NULL — a nullable email here made an omitted email 500 instead of a 422.
            'email' => [
                'required',
                'email',
                'max:255',
                Rule::unique('students', 'email')->whereNull('deleted_at'),
                Rule::unique('users', 'email')->whereNull('deleted_at'),
            ],
            'birth_date' => ['nullable', 'date'],
            'gender' => ['nullable', 'in:male,female,other'],
            'address' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'avatar' => ['nullable', 'url'],
            'status' => ['nullable', 'in:active,inactive,graduated'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Vui lòng nhập tên học viên.',
            'name.max' => 'Tên không được quá 255 ký tự.',
            'phone.unique' => 'Số điện thoại này đã được sử dụng.',
            'email.required' => 'Vui lòng nhập email học viên.',
            'email.email' => 'Địa chỉ email không hợp lệ.',
            'email.unique' => 'Email này đã được sử dụng.',
            'password.required' => 'Vui lòng nhập mật khẩu.',
            'password.min' => 'Mật khẩu phải có ít nhất 8 ký tự.',
            'password.confirmed' => 'Mật khẩu xác nhận không khớp.',
            'gender.in' => 'Giới tính không hợp lệ.',
            'status.in' => 'Trạng thái không hợp lệ.',
        ];
    }
}
