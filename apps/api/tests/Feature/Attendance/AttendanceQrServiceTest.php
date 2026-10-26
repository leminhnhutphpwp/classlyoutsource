<?php

namespace Tests\Feature\Attendance;

use App\Models\ScheduleSession;
use App\Services\AttendanceQrService;
use Tests\TestCase;

class AttendanceQrServiceTest extends TestCase
{
    private function makeSession(int $id = 77): ScheduleSession
    {
        $s = new ScheduleSession;
        $s->id = $id;

        return $s;
    }

    public function test_token_round_trips_to_the_session_id(): void
    {
        $issued = AttendanceQrService::issueToken($this->makeSession(77));

        $this->assertSame(77, AttendanceQrService::validateToken($issued['token']));
        $this->assertStringContainsString('token=', $issued['check_in_url']);
    }

    public function test_tampered_token_is_rejected(): void
    {
        $issued = AttendanceQrService::issueToken($this->makeSession());

        $this->assertNull(AttendanceQrService::validateToken($issued['token'].'tampered'));
        $this->assertNull(AttendanceQrService::validateToken('not-even-encrypted'));
    }

    public function test_expired_token_is_rejected(): void
    {
        $issued = AttendanceQrService::issueToken($this->makeSession());

        $this->travel(AttendanceQrService::TOKEN_TTL_SECONDS + 5)->seconds();

        $this->assertNull(AttendanceQrService::validateToken($issued['token']));
    }

    public function test_generated_code_is_six_chars(): void
    {
        $this->assertSame(6, strlen(AttendanceQrService::generateCode()));
    }
}
