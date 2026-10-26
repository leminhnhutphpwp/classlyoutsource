<?php

namespace Tests\Feature\Settings;

use App\Models\User;
use App\Models\UserNotificationPreference;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Feature tests for GET/PUT /api/v1/settings/notifications.
 *
 * Behaviour guarded here:
 *  - notification types are filtered by the caller's role,
 *  - super_admin is normalized to admin so the settings page is NOT empty
 *    (regression: the seeded administrator carries role 'super_admin', while the
 *    types declare 'admin' — without the mapping the admin got zero types),
 *  - PUT persists preferences (updateOrCreate) and echoes them back,
 *  - only the 'email' channel is accepted (tutor-only system),
 *  - unknown notification types are silently skipped,
 *  - validation fails closed (empty list / empty channels / bad channel → 422),
 *  - unauthenticated → 401.
 */
class NotificationSettingsTest extends TestCase
{
    use RefreshDatabase;

    /** Pull the notification type keys out of a GET response. */
    private function typeKeys(array $data): array
    {
        return array_map(fn ($t) => $t['key'], $data['notification_types']);
    }

    public function test_tutor_sees_tutor_notification_types(): void
    {
        $tutor = $this->tutor();

        $response = $this->actingAsApi($tutor)
            ->getJson('/api/v1/settings/notifications')
            ->assertOk()
            ->assertJsonPath('success', true);

        $keys = $this->typeKeys($response->json('data'));

        $this->assertEqualsCanonicalizing([
            'payment_success',
            'payment_failed',
            'daily_schedule_reminder',
            'attendance_reminder',
            'new_submission',
            'announcement',
        ], $keys);
    }

    public function test_student_sees_only_student_notification_types(): void
    {
        $student = $this->studentUser();

        $response = $this->actingAsApi($student)
            ->getJson('/api/v1/settings/notifications')
            ->assertOk();

        $keys = $this->typeKeys($response->json('data'));

        $this->assertEqualsCanonicalizing([
            'payment_reminder',
            'daily_schedule_reminder',
            'announcement',
        ], $keys);
    }

    /**
     * Regression: super_admin must be treated as admin, otherwise the settings
     * page renders "no notification settings".
     */
    public function test_super_admin_is_treated_as_admin_and_sees_admin_types(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin']);

        $response = $this->actingAsApi($admin)
            ->getJson('/api/v1/settings/notifications')
            ->assertOk();

        $keys = $this->typeKeys($response->json('data'));

        $this->assertNotEmpty($keys, 'super_admin should not get an empty notification type list');
        $this->assertEqualsCanonicalizing([
            'payment_success',
            'payment_failed',
            'announcement',
        ], $keys);
    }

    public function test_only_email_channel_is_offered(): void
    {
        $tutor = $this->tutor();

        $this->actingAsApi($tutor)
            ->getJson('/api/v1/settings/notifications')
            ->assertOk()
            ->assertJsonCount(1, 'data.available_channels')
            ->assertJsonPath('data.available_channels.0.key', 'email');
    }

    public function test_put_persists_preferences(): void
    {
        $tutor = $this->tutor();

        $this->actingAsApi($tutor)
            ->putJson('/api/v1/settings/notifications', [
                'preferences' => [
                    ['notification_type' => 'attendance_reminder', 'channels' => ['email'], 'is_enabled' => false],
                    ['notification_type' => 'new_submission', 'channels' => ['email'], 'is_enabled' => true],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.preferences_count', 2)
            ->assertJsonPath('data.preferences.attendance_reminder.is_enabled', false);

        $this->assertDatabaseHas('user_notification_preferences', [
            'user_id' => $tutor->id,
            'notification_type' => 'attendance_reminder',
            'is_enabled' => false,
        ]);

        // A follow-up GET reflects the saved state.
        $this->actingAsApi($tutor)
            ->getJson('/api/v1/settings/notifications')
            ->assertJsonPath('data.preferences.attendance_reminder.is_enabled', false)
            ->assertJsonPath('data.preferences.new_submission.is_enabled', true);
    }

    public function test_put_updates_existing_preference_without_duplicating_rows(): void
    {
        $tutor = $this->tutor();

        $payload = fn (bool $enabled) => [
            'preferences' => [
                ['notification_type' => 'new_submission', 'channels' => ['email'], 'is_enabled' => $enabled],
            ],
        ];

        $this->actingAsApi($tutor)->putJson('/api/v1/settings/notifications', $payload(false))->assertOk();
        $this->actingAsApi($tutor)->putJson('/api/v1/settings/notifications', $payload(true))->assertOk();

        $this->assertSame(1, UserNotificationPreference::where('user_id', $tutor->id)
            ->where('notification_type', 'new_submission')->count());
        $this->assertTrue((bool) UserNotificationPreference::where('user_id', $tutor->id)
            ->where('notification_type', 'new_submission')->first()->is_enabled);
    }

    public function test_unknown_notification_type_is_skipped(): void
    {
        $tutor = $this->tutor();

        // A valid type alongside an unknown one: the unknown is skipped, the
        // valid one is saved, so the request still succeeds.
        $this->actingAsApi($tutor)
            ->putJson('/api/v1/settings/notifications', [
                'preferences' => [
                    ['notification_type' => 'does_not_exist', 'channels' => ['email'], 'is_enabled' => true],
                    ['notification_type' => 'new_submission', 'channels' => ['email'], 'is_enabled' => true],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.preferences_count', 1);

        $this->assertDatabaseMissing('user_notification_preferences', [
            'user_id' => $tutor->id,
            'notification_type' => 'does_not_exist',
        ]);
        $this->assertDatabaseHas('user_notification_preferences', [
            'user_id' => $tutor->id,
            'notification_type' => 'new_submission',
        ]);
    }

    /**
     * Regression: when a request contains preferences but NONE match a valid
     * notification type for the caller, nothing is saved. The API must report
     * 422 instead of a misleading success so the UI shows an error, not a fake
     * "updated" toast.
     */
    public function test_only_invalid_types_returns_error(): void
    {
        $tutor = $this->tutor();

        // 'payment_reminder' is a student/parent type — invalid for a tutor.
        $this->actingAsApi($tutor)
            ->putJson('/api/v1/settings/notifications', [
                'preferences' => [
                    ['notification_type' => 'does_not_exist', 'channels' => ['email'], 'is_enabled' => true],
                    ['notification_type' => 'payment_reminder', 'channels' => ['email'], 'is_enabled' => true],
                ],
            ])
            ->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('code', 'NO_VALID_PREFERENCES');

        $this->assertDatabaseMissing('user_notification_preferences', [
            'user_id' => $tutor->id,
            'notification_type' => 'payment_reminder',
        ]);
    }

    public function test_invalid_channel_is_rejected(): void
    {
        $tutor = $this->tutor();

        $this->actingAsApi($tutor)
            ->putJson('/api/v1/settings/notifications', [
                'preferences' => [
                    ['notification_type' => 'new_submission', 'channels' => ['sms'], 'is_enabled' => true],
                ],
            ])
            ->assertStatus(422)
            ->assertJsonPath('code', 'VALIDATION_ERROR');
    }

    public function test_empty_channels_are_rejected(): void
    {
        $tutor = $this->tutor();

        $this->actingAsApi($tutor)
            ->putJson('/api/v1/settings/notifications', [
                'preferences' => [
                    ['notification_type' => 'new_submission', 'channels' => [], 'is_enabled' => true],
                ],
            ])
            ->assertStatus(422);
    }

    public function test_empty_preferences_list_is_rejected(): void
    {
        $tutor = $this->tutor();

        $this->actingAsApi($tutor)
            ->putJson('/api/v1/settings/notifications', ['preferences' => []])
            ->assertStatus(422);
    }

    public function test_unauthenticated_returns_401(): void
    {
        $this->getJson('/api/v1/settings/notifications')->assertStatus(401);
        $this->putJson('/api/v1/settings/notifications', [
            'preferences' => [
                ['notification_type' => 'announcement', 'channels' => ['email'], 'is_enabled' => true],
            ],
        ])->assertStatus(401);
    }
}
