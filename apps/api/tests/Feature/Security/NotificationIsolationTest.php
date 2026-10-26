<?php

namespace Tests\Feature\Security;

use App\Models\Notification;
use Tests\TestCase;

/**
 * Cross-tenant access control for notifications.
 * Regression for the P0 IDOR cluster: tutor B must never read/modify/act on tutor A's notification.
 */
class NotificationIsolationTest extends TestCase
{
    private function notificationOwnedBy(int $userId, array $attrs = []): Notification
    {
        return Notification::factory()->create(array_merge([
            'created_by' => $userId,
            'status' => 'draft',
        ], $attrs));
    }

    public function test_other_tutor_cannot_view_notification(): void
    {
        $owner = $this->tutor();
        $attacker = $this->tutor();
        $n = $this->notificationOwnedBy($owner->id, ['status' => 'sent']);

        $this->actingAsApi($attacker)
            ->getJson("/api/v1/notifications/{$n->hash_id}")
            ->assertStatus(404);
    }

    public function test_other_tutor_cannot_update_notification(): void
    {
        $owner = $this->tutor();
        $attacker = $this->tutor();
        $n = $this->notificationOwnedBy($owner->id);

        $this->actingAsApi($attacker)
            ->putJson("/api/v1/notifications/{$n->hash_id}", ['title' => 'hacked'])
            ->assertStatus(404);

        $this->assertDatabaseMissing('notifications', ['id' => $n->id, 'title' => 'hacked']);
    }

    public function test_other_tutor_cannot_delete_notification(): void
    {
        $owner = $this->tutor();
        $attacker = $this->tutor();
        $n = $this->notificationOwnedBy($owner->id);

        $this->actingAsApi($attacker)
            ->deleteJson("/api/v1/notifications/{$n->hash_id}")
            ->assertStatus(404);

        $this->assertDatabaseHas('notifications', ['id' => $n->id]);
    }

    public function test_other_tutor_cannot_send_notification(): void
    {
        $owner = $this->tutor();
        $attacker = $this->tutor();
        $n = $this->notificationOwnedBy($owner->id);

        $this->actingAsApi($attacker)
            ->postJson("/api/v1/notifications/{$n->hash_id}/send")
            ->assertStatus(404);
    }

    public function test_other_tutor_cannot_list_recipients_pii(): void
    {
        $owner = $this->tutor();
        $attacker = $this->tutor();
        $n = $this->notificationOwnedBy($owner->id, ['status' => 'sent']);

        $this->actingAsApi($attacker)
            ->getJson("/api/v1/notifications/{$n->hash_id}/recipients")
            ->assertStatus(404);
    }

    public function test_owner_can_delete_own_notification(): void
    {
        $owner = $this->tutor();
        $n = $this->notificationOwnedBy($owner->id);

        $this->actingAsApi($owner)
            ->deleteJson("/api/v1/notifications/{$n->hash_id}")
            ->assertStatus(200);

        $this->assertSoftDeleted('notifications', ['id' => $n->id]);
    }
}
