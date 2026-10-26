<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class PaymentRequest extends Model
{
    use \App\Traits\HasHashId, HasFactory, SoftDeletes;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'class_id',
        'created_by',
        'period_name',
        'period_month',
        'amount_per_student',
        'due_date',
        'description',
        'status',
        'metadata',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'amount_per_student' => 'decimal:2',
            'due_date' => 'date',
            'metadata' => 'array',
        ];
    }

    /**
     * Get the class for this payment request.
     */
    public function class(): BelongsTo
    {
        return $this->belongsTo(ClassRoom::class, 'class_id');
    }

    /**
     * Get the tutor who created this payment request.
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get all payments linked to this payment request.
     */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    /**
     * Get paid payments.
     */
    public function paidPayments(): HasMany
    {
        return $this->payments()->where('status', 'paid');
    }

    /**
     * Get pending payments.
     */
    public function pendingPayments(): HasMany
    {
        return $this->payments()->where('status', 'pending');
    }

    /**
     * Get total amount collected (from paid payments).
     */
    public function getTotalCollectedAttribute(): float
    {
        return (float) $this->paidPayments()->sum('amount');
    }

    /**
     * Get total amount pending (from pending payments).
     */
    public function getTotalPendingAttribute(): float
    {
        return (float) $this->pendingPayments()->sum('amount');
    }

    /**
     * Get total amount expected (all students in class * amount_per_student).
     */
    public function getTotalExpectedAttribute(): float
    {
        $studentCount = $this->class->getActiveStudentCount();

        return (float) ($studentCount * $this->amount_per_student);
    }

    /**
     * Get number of students who have paid.
     */
    public function getPaidStudentsCountAttribute(): int
    {
        return $this->paidPayments()->distinct('student_id')->count('student_id');
    }

    /**
     * Get number of students who haven't paid.
     */
    public function getUnpaidStudentsCountAttribute(): int
    {
        $totalStudents = $this->class->getActiveStudentCount();

        return max(0, $totalStudents - $this->paid_students_count);
    }

    /**
     * Check if payment request is active.
     */
    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    /**
     * Check if payment request is overdue.
     */
    public function isOverdue(): bool
    {
        return $this->isActive() && $this->due_date->isPast();
    }

    /**
     * Check if all students have paid.
     */
    public function isFullyPaid(): bool
    {
        $totalStudents = $this->class->getActiveStudentCount();

        return $this->paid_students_count >= $totalStudents;
    }

    /**
     * Get payment status summary.
     */
    public function getStatusSummary(): array
    {
        $totalStudents = $this->class->getActiveStudentCount();
        $paidCount = $this->paid_students_count;
        $unpaidCount = $this->unpaid_students_count;

        return [
            'total_students' => $totalStudents,
            'paid_students' => $paidCount,
            'unpaid_students' => $unpaidCount,
            'total_expected' => $this->total_expected,
            'total_collected' => $this->total_collected,
            'total_pending' => $this->total_pending,
            'total_debt' => $this->total_expected - $this->total_collected,
            'is_fully_paid' => $this->isFullyPaid(),
            'is_overdue' => $this->isOverdue(),
            'completion_rate' => $totalStudents > 0 ? round(($paidCount / $totalStudents) * 100, 2) : 0,
        ];
    }
}
