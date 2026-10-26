<?php

namespace App\Support;

use Illuminate\Support\MessageBag;

/**
 * Translates Laravel validation errors into Vietnamese messages. Extracted verbatim from
 * BaseController (self-contained: pure MessageBag->array, no controller state).
 */
class ValidationMessageTranslator
{
    /**
     * Format validation errors to Vietnamese messages.
     */
    public static function translate(MessageBag $errors, $validator = null): array
    {
        $formatted = [];

        // Vietnamese validation messages
        $vietnameseMessages = [
            'required' => 'Trường :attribute là bắt buộc.',
            'email' => 'Trường :attribute phải là địa chỉ email hợp lệ.',
            'min.string' => 'Trường :attribute phải có ít nhất :min ký tự.',
            'min.numeric' => 'Trường :attribute phải có ít nhất :min.',
            'min.array' => 'Trường :attribute phải có ít nhất :min phần tử.',
            'max.string' => 'Trường :attribute không được vượt quá :max ký tự.',
            'max.numeric' => 'Trường :attribute không được vượt quá :max.',
            'max.array' => 'Trường :attribute không được vượt quá :max phần tử.',
            'string' => 'Trường :attribute phải là chuỗi ký tự.',
            'numeric' => 'Trường :attribute phải là số.',
            'integer' => 'Trường :attribute phải là số nguyên.',
            'confirmed' => 'Xác nhận :attribute không khớp.',
            'unique' => 'Trường :attribute đã tồn tại.',
            'exists' => 'Trường :attribute không hợp lệ.',
            'in' => 'Trường :attribute không hợp lệ.',
            'date' => 'Trường :attribute phải là ngày hợp lệ.',
            'after' => 'Trường :attribute phải sau :date.',
            'array' => 'Trường :attribute phải là một mảng.',
            'boolean' => 'Trường :attribute phải là true hoặc false.',
            'required_if' => 'Trường :attribute là bắt buộc khi :other là :value.',
            'before' => 'Trường :attribute phải trước :date.',
            'after_or_equal' => 'Trường :attribute phải sau hoặc bằng :date.',
            'before_or_equal' => 'Trường :attribute phải trước hoặc bằng :date.',
            'between.numeric' => 'Trường :attribute phải nằm trong khoảng :min đến :max.',
            'between.string' => 'Trường :attribute phải có độ dài từ :min đến :max ký tự.',
            'between.array' => 'Trường :attribute phải có từ :min đến :max phần tử.',
            'digits' => 'Trường :attribute phải có :digits chữ số.',
            'digits_between' => 'Trường :attribute phải có từ :min đến :max chữ số.',
            'url' => 'Trường :attribute phải là một đường dẫn URL hợp lệ.',
            'date_format' => 'Trường :attribute không đúng định dạng :format.',
            'mimes' => 'Trường :attribute phải là tập tin có định dạng: :values.',
            'gt.numeric' => 'Trường :attribute phải lớn hơn :value.',
            'gt.string' => 'Trường :attribute phải dài hơn :value ký tự.',
            'lt.numeric' => 'Trường :attribute phải nhỏ hơn :value.',
            'lt.string' => 'Trường :attribute phải ngắn hơn :value ký tự.',
            'gte.numeric' => 'Trường :attribute phải lớn hơn hoặc bằng :value.',
            'gte.string' => 'Trường :attribute phải dài hơn hoặc bằng :value ký tự.',
            'lte.numeric' => 'Trường :attribute phải nhỏ hơn hoặc bằng :value.',
            'lte.string' => 'Trường :attribute phải ngắn hơn hoặc bằng :value ký tự.',
            'same' => 'Trường :attribute và :other phải giống nhau.',
            'different' => 'Trường :attribute và :other phải khác nhau.',
        ];

        // Attribute names in Vietnamese
        $attributeNames = [
            'email' => 'email',
            'password' => 'mật khẩu',
            'name' => 'tên',
            'phone' => 'số điện thoại',
            'role' => 'vai trò',
            'class_id' => 'lớp học',
            'student_id' => 'học sinh',
            'tutor_id' => 'gia sư',
            'subject' => 'môn học',
            'subject_id' => 'môn học',
            'start_date' => 'ngày bắt đầu',
            'end_date' => 'ngày kết thúc',
            'start_time' => 'giờ bắt đầu',
            'end_time' => 'giờ kết thúc',
            'tuition_fee' => 'học phí',
            'max_students' => 'số học sinh tối đa',
            'title' => 'tiêu đề',
            'message' => 'nội dung',
            'priority' => 'mức độ ưu tiên',
            'recipient_type' => 'loại người nhận',
            'recipient_ids' => 'danh sách người nhận',
            'channel' => 'kênh',
            'lesson_date' => 'ngày học',
            'content' => 'nội dung',
            'homework' => 'bài tập về nhà',
            'objectives' => 'mục tiêu',
            'materials' => 'tài liệu',
            'student_performance' => 'hiệu suất học sinh',
            'notes' => 'ghi chú',
            'rating' => 'đánh giá',
            'amount' => 'số tiền',
            'transaction_id' => 'mã giao dịch',
            'payment_method' => 'phương thức thanh toán',
            'plan_id' => 'gói',
            'months' => 'số tháng',
            'recurring_type' => 'kiểu lặp lại',
            'recurring_days' => 'ngày lặp lại',
            'online_platform' => 'nền tảng trực tuyến',
            'online_meeting_url' => 'đường dẫn cuộc họp',
            'room' => 'phòng học',
            'location' => 'địa điểm',
            'default_mode' => 'chế độ mặc định',
        ];

        // Specific value translations
        $valueTranslations = [
            'daily' => 'hàng ngày',
            'weekly' => 'hàng tuần',
            'monthly' => 'hàng tháng',
            'custom' => 'tùy chỉnh',
            'once' => 'một lần',
            'online' => 'trực tuyến',
            'offline' => 'trực tiếp',
            'tutor' => 'gia sư',
            'student' => 'học viên',
        ];

        foreach ($errors->messages() as $key => $messages) {
            $formatted[$key] = [];
            $attribute = $attributeNames[$key] ?? $key;

            foreach ($messages as $message) {
                // Check if it's a Laravel validation key (e.g., "validation.min.string")
                if (strpos($message, 'validation.') === 0) {
                    // Extract rule from key: "validation.min.string" -> ["min", "string"]
                    $ruleKey = str_replace('validation.', '', $message);
                    $ruleParts = explode('.', $ruleKey);

                    // Build message key (e.g., "min.string" or "required")
                    $messageKey = count($ruleParts) > 1
                        ? $ruleParts[0].'.'.$ruleParts[1]
                        : $ruleParts[0];

                    // Get the rule parameters from the original error
                    // Laravel stores them in format rules, we need to extract them
                    $ruleName = $ruleParts[0]; // "min", "max", etc.
                    $ruleType = $ruleParts[1] ?? 'string'; // "string", "numeric", etc.

                    // Get message template
                    $fullKey = $ruleName.'.'.$ruleType;
                    $messageTemplate = $vietnameseMessages[$fullKey]
                        ?? $vietnameseMessages[$ruleName]
                        ?? $message;

                    // Replace :attribute
                    $formattedMessage = str_replace(':attribute', $attribute, $messageTemplate);

                    // Extract rule parameters from validator
                    if ($validator) {
                        try {
                            $rules = $validator->getRules();
                            if (isset($rules[$key])) {
                                $fieldRules = is_array($rules[$key]) ? $rules[$key] : explode('|', $rules[$key]);
                                foreach ($fieldRules as $rule) {
                                    if (is_string($rule) && (strpos($rule, $ruleName.':') === 0)) {
                                        // Extract value after "ruleName:"
                                        $parts = explode(':', $rule, 2);
                                        if (count($parts) === 2) {
                                            $paramString = $parts[1];
                                            $params = explode(',', $paramString);

                                            // Handle specific rules replacements
                                            if (in_array($ruleName, ['min', 'max', 'size', 'gt', 'lt', 'gte', 'lte'])) {
                                                $formattedMessage = str_replace([':min', ':max', ':size', ':value'], $params[0], $formattedMessage);
                                            } elseif (in_array($ruleName, ['after', 'before', 'after_or_equal', 'before_or_equal'])) {
                                                // If value is another attribute, try to translate it
                                                $dateParam = $params[0];
                                                $translatedDateParam = $attributeNames[$dateParam] ?? $dateParam;
                                                $formattedMessage = str_replace(':date', $translatedDateParam, $formattedMessage);
                                            } elseif ($ruleName === 'between') {
                                                $formattedMessage = str_replace([':min', ':max'], [$params[0], $params[1] ?? ''], $formattedMessage);
                                            } elseif (in_array($ruleName, ['required_if', 'same', 'different'])) {
                                                $otherField = $params[0];
                                                $expectedValue = $params[1] ?? '';

                                                $translatedOther = $attributeNames[$otherField] ?? $otherField;
                                                $translatedValue = $valueTranslations[$expectedValue] ?? $expectedValue;

                                                $formattedMessage = str_replace(':other', $translatedOther, $formattedMessage);
                                                $formattedMessage = str_replace(':value', $translatedValue, $formattedMessage);
                                            } elseif ($ruleName === 'digits') {
                                                $formattedMessage = str_replace(':digits', $params[0], $formattedMessage);
                                            } elseif ($ruleName === 'digits_between') {
                                                $formattedMessage = str_replace([':min', ':max'], [$params[0], $params[1] ?? ''], $formattedMessage);
                                            } elseif ($ruleName === 'date_format') {
                                                $formattedMessage = str_replace(':format', $params[0], $formattedMessage);
                                            } elseif ($ruleName === 'mimes') {
                                                $formattedMessage = str_replace(':values', str_replace(',', ', ', $paramString), $formattedMessage);
                                            }

                                            break;
                                        }
                                    }
                                }
                            }
                        } catch (\Exception $e) {
                            // If getting rules fails, continue with default message
                        }
                    }

                    $formatted[$key][] = $formattedMessage;
                } else {
                    // Already formatted message, just replace attribute name
                    $formatted[$key][] = str_replace(':attribute', $attribute, $message);
                }
            }
        }

        return $formatted;
    }
}
