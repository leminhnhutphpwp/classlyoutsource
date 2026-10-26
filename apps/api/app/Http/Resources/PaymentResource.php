<?php

namespace App\Http\Resources;

use App\Models\ClassRoom;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\PaymentRequest;
use App\Models\Student;
use App\Support\CurrencyHelper;
use App\Support\ReferenceCode;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PaymentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            '_id' => $this->hash_id,
            'reference_code' => $this->reference_code ?? ReferenceCode::fallbackPayment($this->id),
            'class_id' => ClassRoom::encodeId($this->class_id),
            'student_id' => Student::encodeId($this->student_id),
            'payment_request_id' => $this->payment_request_id ? PaymentRequest::encodeId($this->payment_request_id) : null,
            'invoice_number' => $this->invoice_number,
            'amount' => (float) $this->amount,
            'amount_formatted' => CurrencyHelper::formatWithoutSign($this->amount),
            'refunded_amount' => $this->refunded_amount !== null ? (float) $this->refunded_amount : null,
            'refunded_amount_formatted' => $this->refunded_amount !== null
                ? CurrencyHelper::formatWithoutSign($this->refunded_amount)
                : null,
            'refunded_at' => $this->refunded_at?->toISOString(),
            'payment_method' => $this->payment_method,
            'payment_method_label' => $this->getPaymentMethodLabel(),
            'transaction_id' => $this->transaction_id,
            'month' => $this->month,
            'payment_date' => $this->payment_date?->toDateString(),
            'due_date' => $this->due_date?->toDateString(),
            'status' => $this->status,
            'status_label' => $this->getStatusLabel(),
            'note' => $this->note,

            // Relationships
            // Removed: customer (no longer exists in tutor-only system)
            'class' => new ClassRoomResource($this->whenLoaded('class')),
            'student' => new StudentResource($this->whenLoaded('student')),
            'payment_request' => $this->whenLoaded('paymentRequest', fn () => new PaymentRequestResource($this->paymentRequest)),

            // Timestamps
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),

            // Bank Transfer Info (Only if Pending — transfer info is the single way a student/parent
            // can settle tuition, regardless of the recorded payment_method on a pending payment)
            'bank_transfer_info' => $this->when($this->status === 'pending', function () {
                return $this->getBankTransferInfo();
            }),
        ];
    }

    /**
     * Get status label in Vietnamese.
     */
    protected function getStatusLabel(): string
    {
        return match ($this->status) {
            'paid' => 'Đã thanh toán',
            'pending' => 'Chờ thanh toán',
            'failed' => 'Thanh toán thất bại',
            'refunded' => 'Đã hoàn tiền',
            default => $this->status ?? 'N/A',
        };
    }

    /**
     * Get payment method label in Vietnamese.
     */
    protected function getPaymentMethodLabel(): string
    {
        return match ($this->payment_method) {
            'bank' => 'Chuyển khoản',
            'cash' => 'Tiền mặt',
            'card' => 'Thẻ tín dụng',
            'free' => 'Miễn phí',
            default => $this->payment_method ?? 'N/A',
        };
    }

    /**
     * Get bank transfer information for manual verification (Organization's default bank account).
     *
     * Delegates to Organization::bankTransferInfoFor() — the single source of truth shared with
     * ParentController::paymentIntent(), so both flows always return the same account + QR data.
     *
     * Uses the class's eager-loaded organization (class.organization.bankAccounts) when present —
     * serializing a page of pending payments costs no extra query per row; falls back to
     * Organization::find() only when the relation wasn't loaded.
     */
    public function getBankTransferInfo(): ?array
    {
        $class = $this->resource->class;
        if (! $class) {
            // Fallback: If no class loaded, try loading from DB
            $payment = Payment::find($this->id);
            if ($payment && $payment->class) {
                $class = $payment->class;
            }
        }

        if (! $class || ! $class->organization_id) {
            return null;
        }

        $organization = $class->relationLoaded('organization')
            ? $class->organization
            : Organization::find($class->organization_id);
        if (! $organization) {
            return null;
        }

        $paymentReference = $this->resource->reference_code ?? ReferenceCode::fallbackPayment($this->id);

        return $organization->bankTransferInfoFor((float) $this->amount, $paymentReference);
    }
}
