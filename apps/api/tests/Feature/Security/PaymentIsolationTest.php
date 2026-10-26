<?php

namespace Tests\Feature\Security;

use App\Models\ClassRoom;
use App\Models\PaymentRequest;
use App\Models\Student;
use Tests\TestCase;

/**
 * Regression for the "if (isTutor())"-gated ownership bypass on payment endpoints:
 * the ownership scope was applied only for tutors, so any non-tutor (or another tutor) could read
 * another tenant's payments / billing.
 */
class PaymentIsolationTest extends TestCase
{
    private function paymentRequestFor(ClassRoom $class, int $creatorId): PaymentRequest
    {
        return PaymentRequest::create([
            'class_id' => $class->id,
            'created_by' => $creatorId,
            'period_name' => 'Đợt 1',
            'amount_per_student' => 500000,
            'due_date' => now()->addWeek()->toDateString(),
            'status' => 'pending',
        ]);
    }

    public function test_other_tutor_cannot_read_student_payments(): void
    {
        $owner = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $owner->id]);
        $student = Student::factory()->create(['class_id' => $class->id]);
        $attacker = $this->tutor();

        $this->actingAsApi($attacker)
            ->getJson("/api/v1/payments/student/{$student->hash_id}")
            ->assertStatus(404);
    }

    public function test_owner_can_read_student_payments(): void
    {
        $owner = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $owner->id]);
        $student = $this->studentInClass($class);

        $this->actingAsApi($owner)
            ->getJson("/api/v1/payments/student/{$student->hash_id}")
            ->assertStatus(200);
    }

    public function test_other_tutor_cannot_list_payment_requests_of_foreign_class(): void
    {
        $owner = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $owner->id]);
        $attacker = $this->tutor();

        $this->actingAsApi($attacker)
            ->getJson("/api/v1/classes/{$class->hash_id}/payment-requests")
            ->assertStatus(404);
    }

    public function test_other_tutor_cannot_view_payment_request(): void
    {
        $owner = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $owner->id]);
        $pr = $this->paymentRequestFor($class, $owner->id);
        $attacker = $this->tutor();

        $this->actingAsApi($attacker)
            ->getJson("/api/v1/payment-requests/{$pr->hash_id}")
            ->assertStatus(403);
    }

    public function test_owner_can_view_payment_request(): void
    {
        $owner = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $owner->id]);
        $pr = $this->paymentRequestFor($class, $owner->id);

        $this->actingAsApi($owner)
            ->getJson("/api/v1/payment-requests/{$pr->hash_id}")
            ->assertStatus(200);
    }

    public function test_other_tutor_cannot_delete_payment_request(): void
    {
        $owner = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $owner->id]);
        $pr = $this->paymentRequestFor($class, $owner->id);
        $attacker = $this->tutor();

        $this->actingAsApi($attacker)
            ->deleteJson("/api/v1/payment-requests/{$pr->hash_id}")
            ->assertStatus(403);

        $this->assertDatabaseHas('payment_requests', ['id' => $pr->id]);
    }

    public function test_owner_tutor_can_read_payments_of_created_but_not_yet_enrolled_student(): void
    {
        $owner = $this->tutor();
        // Student created by the tutor but not enrolled in any class yet.
        $student = Student::factory()->create(['created_by' => $owner->id, 'class_id' => null]);

        $this->actingAsApi($owner)
            ->getJson("/api/v1/payments/student/{$student->hash_id}")
            ->assertStatus(200);
    }

    public function test_student_user_cannot_read_another_students_payments(): void
    {
        $owner = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $owner->id]);
        $victim = $this->studentInClass($class);

        // A logged-in student user who is NOT the victim.
        $attacker = $this->studentUser();

        $this->actingAsApi($attacker)
            ->getJson("/api/v1/payments/student/{$victim->hash_id}")
            ->assertStatus(404);
    }
}
