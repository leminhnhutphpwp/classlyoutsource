<?php

namespace App\Models;

use App\Traits\HasHashId;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Membership of a User in an Organization, carrying the org_role (owner|manager|tutor).
 * org_role is intentionally kept OFF User.role / Spatie global roles.
 */
class OrganizationMember extends Model
{
    use HasFactory, HasHashId, SoftDeletes;

    protected $fillable = [
        'organization_id',
        'user_id',
        'org_role',
        'status',
        'invited_by',
        'joined_at',
    ];

    protected function casts(): array
    {
        return [
            'joined_at' => 'datetime',
        ];
    }

    /**
     * The organization this membership belongs to.
     */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    /**
     * The member user.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * The user who sent the invite (nullable).
     */
    public function invitedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'invited_by');
    }

    /**
     * Scope to active memberships.
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public function isOwner(): bool
    {
        return $this->org_role === 'owner';
    }

    public function isManager(): bool
    {
        return $this->org_role === 'manager';
    }

    /**
     * owner or manager → may view/aggregate the whole org.
     */
    public function isViewerAll(): bool
    {
        return in_array($this->org_role, ['owner', 'manager'], true);
    }
}
