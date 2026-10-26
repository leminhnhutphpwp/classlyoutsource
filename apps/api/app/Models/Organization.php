<?php

namespace App\Models;

use App\Traits\HasHashId;
use App\Support\VietQrBank;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A tutoring center / organization. Owns many members (tutors/managers) and, via
 * classes.organization_id, many classes. org_role is stored on the pivot, not on User.role.
 */
class Organization extends Model
{
    use HasFactory, HasHashId, SoftDeletes;

    protected $fillable = [
        'owner_id',
        'name',
        'slug',
        'description',
        'logo_media_id',
        'settings',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'settings' => 'array',
        ];
    }

    /**
     * The user who owns (created) this organization.
     */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    /**
     * All membership rows (any status) for this organization.
     */
    public function members(): HasMany
    {
        return $this->hasMany(OrganizationMember::class);
    }

    /**
     * Only active membership rows.
     */
    public function activeMembers(): HasMany
    {
        return $this->members()->where('status', 'active');
    }

    /**
     * Classes that belong to this organization (organization_id = this->id).
     */
    public function classes(): HasMany
    {
        return $this->hasMany(ClassRoom::class, 'organization_id');
    }

    /**
     * Bank accounts of this organization.
     */
    public function bankAccounts(): HasMany
    {
        return $this->hasMany(OrganizationBankAccount::class);
    }

    /**
     * Get the default bank account of this organization.
     *
     * Uses the already-loaded relation when eager-loaded (e.g.
     * ClassRoom.with('organization.bankAccounts')) so serializing a page of pending
     * payments costs no extra query per row; falls back to a single query otherwise.
     */
    public function defaultBankAccount(): ?OrganizationBankAccount
    {
        if ($this->relationLoaded('bankAccounts')) {
            return $this->bankAccounts->firstWhere('is_default', true);
        }

        return $this->bankAccounts()->where('is_default', true)->first();
    }

    /**
     * Build the bank-transfer payload shown to students/parents when paying tuition.
     *
     * Single source of truth for both PaymentResource::getBankTransferInfo() and
     * ParentController::paymentIntent(), so the two flows can never drift apart.
     *
     * Returns null when the organization has no (usable) default bank account.
     *
     * @return array{bank_name: string, account_number: string, account_holder: string, branch: ?string, transfer_content: string, qr_code_url: ?string, instructions: string}|null
     */
    public function bankTransferInfoFor(float $amount, string $reference): ?array
    {
        $bankAccount = $this->defaultBankAccount();
        if (! $bankAccount || empty($bankAccount->bank_name) || empty($bankAccount->account_number)) {
            return null;
        }

        $globalSettings = Setting::getByGroup('payment');
        $template = $globalSettings['bank_transfer_content_template'] ?? null;

        // Per-account memo wins over the global template: the center can set a distinct
        // transfer content for each bank account. Both support the [Mã đơn hàng] placeholder.
        $contentSource = $bankAccount->memo ?: $template;
        $transferContent = $contentSource
            ? str_replace('[Mã đơn hàng]', $reference, $contentSource)
            : $reference;

        // Invariant: the transfer content MUST carry the payment reference — SePay's webhook
        // reconciles by extracting it (regex "CLSPAYxxxxx") from what the student actually
        // typed, and it is also how the center tells payers apart on the bank statement. If
        // the center's memo has no placeholder (or the raw reference), append it so every
        // tuition transfer stays traceable no matter what the center typed.
        if (! str_contains($transferContent, $reference)) {
            $transferContent = trim($transferContent.' '.$reference);
        }

        // img.vietqr.io expects the bank SHORT CODE (e.g. TCB, VCB) — never the raw display name.
        // Fall back to the raw name so an unrecognized bank still produces a URL, but known banks
        // always resolve to a valid code.
        $bankId = VietQrBank::codeFor($bankAccount->bank_name) ?? $bankAccount->bank_name;
        $qrCodeUrl = "https://img.vietqr.io/image/{$bankId}-{$bankAccount->account_number}-compact.jpg"
            . "?amount={$amount}&addInfo=".urlencode($transferContent)
            . '&accountName='.urlencode($bankAccount->account_name ?? '');

        // Replace the placeholder with the RAW reference — the instructions template already
        // contains its own prefix (e.g. "CLASSLY [Mã đơn hàng]"), so feeding it the prefixed
        // transferContent would duplicate the prefix ("CLASSLY CLASSLY ...").
        $instructions = $globalSettings['bank_transfer_instructions'] ?? '';
        $instructions = str_replace('[Mã đơn hàng]', $reference, $instructions);

        return [
            'bank_name' => $bankAccount->bank_name,
            'account_number' => $bankAccount->account_number,
            'account_holder' => $bankAccount->account_name ?? '',
            'branch' => $bankAccount->branch ?? null,
            'transfer_content' => $transferContent,
            'qr_code_url' => $qrCodeUrl,
            'instructions' => $instructions,
        ];
    }

    /**
     * IDs of users who are active members of this org (owner + managers + tutors).
     * Basis for the org isolation `orgTutorIds` set used in Phase 2.
     *
     * @return array<int>
     */
    public function activeMemberUserIds(): array
    {
        return $this->activeMembers()->pluck('user_id')->all();
    }

    /**
     * Scope a query to only active organizations.
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }
}
