<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Raised whenever an AI (Anthropic) call cannot produce a usable result:
 * feature disabled, missing key, model refusal, rate-limit exhaustion, or a
 * transport/parse error. Controllers translate this into a clean JSON envelope
 * instead of leaking a 500.
 */
class AiException extends RuntimeException
{
    /** Machine-readable reason (disabled|refusal|rate_limited|upstream|invalid_response). */
    public string $reason;

    public function __construct(string $message, string $reason = 'upstream', int $code = 0, ?\Throwable $previous = null)
    {
        parent::__construct($message, $code, $previous);
        $this->reason = $reason;
    }

    public static function disabled(): self
    {
        return new self('AI chưa được bật. Vui lòng liên hệ quản trị viên để kích hoạt tính năng AI.', 'disabled');
    }

    public static function refusal(): self
    {
        return new self('AI đã từ chối xử lý yêu cầu này. Vui lòng điều chỉnh nội dung và thử lại.', 'refusal');
    }

    public static function rateLimited(): self
    {
        return new self('Hệ thống AI đang quá tải. Vui lòng thử lại sau ít phút.', 'rate_limited');
    }

    public static function upstream(string $detail = ''): self
    {
        return new self('Không thể kết nối tới dịch vụ AI. Vui lòng thử lại sau.'.($detail ? ' ('.$detail.')' : ''), 'upstream');
    }

    public static function invalidResponse(): self
    {
        return new self('Phản hồi từ AI không hợp lệ. Vui lòng thử lại.', 'invalid_response');
    }
}
