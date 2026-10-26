<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Traits\HasHashId;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Spatie\Permission\Traits\HasRoles;
use Tymon\JWTAuth\Contracts\JWTSubject;

class User extends Authenticatable implements JWTSubject
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, HasHashId, HasRoles, Notifiable, SoftDeletes;

    protected $guard_name = 'web';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'email_verified_at',
        'password',
        'role',
        'phone',
        'avatar',
        'avatar_media_id',
        'address',
        'bio',
        'status',
        'suspended_at',
        'suspended_reason',
        'provisioned_org_id',
        'fraud_guard_whitelisted',
        'theme_key',
        'mode',
        'pending_email',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'two_factor_secret',
        'two_factor_recovery_codes',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'suspended_at' => 'datetime',
            'password' => 'hashed',
            // TOTP 2FA — encrypted at rest; only ever surfaced in plaintext by the
            // one-time enable/confirm responses, never serialized (see $hidden).
            'two_factor_secret' => 'encrypted',
            'two_factor_recovery_codes' => 'encrypted:array',
            'two_factor_confirmed_at' => 'datetime',
        ];
    }

    /**
     * Whether the user has fully enabled (secret generated AND confirmed) TOTP 2FA.
     * `two_factor_confirmed_at` is the single source of truth for "2FA on".
     */
    public function hasTwoFactorEnabled(): bool
    {
        return $this->two_factor_confirmed_at !== null;
    }

    /**
     * Get the avatar media (Media).
     */
    public function avatarMedia(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'avatar_media_id');
    }

    /**
     * Get classes taught by this tutor.
     */
    public function classes(): HasMany
    {
        return $this->hasMany(ClassRoom::class, 'tutor_id');
    }

    /**
     * Get student profile associated with this user.
     */
    public function studentProfile(): HasMany
    {
        return $this->hasMany(Student::class, 'user_id');
    }

    /**
     * Get attendance records created by this tutor.
     */
    public function attendancesCreated(): HasMany
    {
        return $this->hasMany(Attendance::class, 'tutor_id');
    }

    /**
     * Get payments collected by this user.
     */
    public function paymentsCollected(): HasMany
    {
        return $this->hasMany(Payment::class, 'collected_by');
    }

    /**
     * Get notifications created by this user.
     */
    public function notificationsCreated(): HasMany
    {
        return $this->hasMany(Notification::class, 'created_by');
    }

    /**
     * Get login history entries for this user.
     */
    public function loginActivities(): HasMany
    {
        return $this->hasMany(LoginActivity::class);
    }

    /**
     * Get assignments created by this tutor.
     */
    public function assignments(): HasMany
    {
        return $this->hasMany(Assignment::class, 'tutor_id');
    }

    /**
     * Get submissions graded by this tutor.
     */
    public function submissionsGraded(): HasMany
    {
        return $this->hasMany(Submission::class, 'graded_by');
    }

    /**
     * Get grades created by this tutor.
     */
    public function grades(): HasMany
    {
        return $this->hasMany(Grade::class, 'tutor_id');
    }

    /**
     * Get lesson notes created by this tutor.
     */
    public function lessonNotes(): HasMany
    {
        return $this->hasMany(LessonNote::class, 'tutor_id');
    }

    /**
     * Check if user is admin.
     */
    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    /**
     * Check if user is super admin.
     */
    public function isSuperAdmin(): bool
    {
        return $this->role === 'super_admin' || $this->hasRole('super_admin');
    }

    /**
     * Check if user is tutor (gia sư).
     */
    public function isTutor(): bool
    {
        return $this->role === 'tutor';
    }

    /**
     * Check if user is student.
     */
    public function isStudent(): bool
    {
        return $this->role === 'student';
    }

    /**
     * Check if user is parent.
     */
    public function isParent(): bool
    {
        return $this->role === 'parent';
    }

    /**
     * Students this user (a parent) guards, via the guardian_student pivot. Only active links.
     */
    public function guardedStudents(): BelongsToMany
    {
        return $this->belongsToMany(Student::class, 'guardian_student', 'user_id', 'student_id')
            ->withPivot('relationship', 'is_primary', 'status')
            ->wherePivot('status', 'active')
            ->withTimestamps();
    }

    /**
     * IDs of the students this parent guards (active links only).
     *
     * @return array<int>
     */
    public function guardedStudentIds(): array
    {
        return $this->guardedStudents()->pluck('students.id')->all();
    }

    /**
     * Check if user is active.
     */
    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    /**
     * Whether login/authentication is BLOCKED because a center suspended this account (Ops-fix A,
     * design §2.2). Orthogonal to status/isActive() — a suspended account may still be status=active.
     * This is the single source of truth gated at login AND at authenticated-JWT resolution
     * (AuthenticateApi), which is what makes suspension revoke a LIVE token immediately.
     */
    public function isLoginBlocked(): bool
    {
        return $this->suspended_at !== null;
    }

    // ----------------------------------------------------------------------
    // Organization (trung tâm) — additive layer. org_role lives on the pivot
    // (organization_members.org_role), NOT on User.role. See docs/design/organization-mvp.md.
    // ----------------------------------------------------------------------

    /** Request-scoped cache for the resolved active membership (false = resolved-but-none). */
    protected $currentOrganizationMemberCache = null;

    /**
     * All membership rows for this user (any status).
     */
    public function organizationMemberships(): HasMany
    {
        return $this->hasMany(OrganizationMember::class);
    }

    /**
     * The user's single ACTIVE membership (MVP single-org rule → at most one).
     */
    public function organizationMembership(): HasOne
    {
        return $this->hasOne(OrganizationMember::class)->where('status', 'active');
    }

    /**
     * The resolved active membership, cached per request (mirrors getOwnerTutor caching intent).
     */
    public function currentMembership(): ?OrganizationMember
    {
        if ($this->currentOrganizationMemberCache === null) {
            $this->currentOrganizationMemberCache = $this->organizationMembership()->first() ?: false;
        }

        return $this->currentOrganizationMemberCache ?: null;
    }

    /**
     * The organization the user currently belongs to, or null. Single query via the active membership.
     */
    public function currentOrganization(): ?Organization
    {
        return $this->currentMembership()?->organization;
    }

    /**
     * The user's org_role in their current org: 'owner'|'manager'|'tutor'|null.
     */
    public function orgRole(): ?string
    {
        return $this->currentMembership()?->org_role;
    }

    /**
     * Whether the user has an active organization membership.
     */
    public function belongsToOrganization(): bool
    {
        return $this->currentMembership() !== null;
    }

    public function isOrgOwner(): bool
    {
        return $this->orgRole() === 'owner';
    }

    public function isOrgManager(): bool
    {
        return $this->orgRole() === 'manager';
    }

    /**
     * owner || manager → allowed to view/aggregate the whole org (Phase 2 isolation branch).
     */
    public function isOrgViewerAll(): bool
    {
        return in_array($this->orgRole(), ['owner', 'manager'], true);
    }

    /**
     * A plain member tutor (in an org but NOT owner/manager) — inherits permissions from the owner.
     */
    public function isOrgMemberTutor(): bool
    {
        return $this->orgRole() === 'tutor';
    }

    /**
     * FINANCE-ONLY org role (kế toán). NOT a viewer-all — see design §5 QĐ 3. Kept out of
     * isOrgViewerAll() on purpose: an accountant reads finance (payments / payment-requests / student
     * billing) but is fail-closed on ALL teaching data. Isolation routes it through its own branch.
     */
    public function isOrgAccountant(): bool
    {
        return $this->orgRole() === 'accountant';
    }

    /**
     * User locks (khóa tài khoản trực tiếp trên user).
     */
    public function locks(): HasMany
    {
        return $this->hasMany(UserLock::class);
    }

    /**
     * Các lock đang active (trong thời gian hiệu lực) gắn trực tiếp vào user này.
     */
    public function activeLocks(): HasMany
    {
        return $this->locks()->active();
    }

    /**
     * Lấy gia sư (tutor) “chủ” của user hiện tại.
     * - Nếu là tutor: trả về chính nó.
     * - Nếu là student: tìm Student profile -> lớp đầu tiên -> tutor.
     */
    public function getOwnerTutor(): ?self
    {
        if ($this->isTutor()) {
            return $this;
        }

        if ($this->isStudent()) {
            $student = Student::where('user_id', $this->id)
                ->with(['classes' => function ($query) {
                    $query->select('classes.id', 'tutor_id');
                }, 'creator']) // Eager load creator
                ->first();

            if (! $student) {
                return null;
            }

            // Priority 1: Tutor of the latest enrolled class
            $class = $student->classes->first();
            if ($class && $class->tutor) {
                return $class->tutor;
            }

            // Priority 2: The user who created this student profile (if they are a tutor)
            if ($student->creator && $student->creator->isTutor()) {
                return $student->creator;
            }

            return null;
        }

        return null;
    }

    /**
     * Kiểm tra user (hoặc gia sư chủ của user) có bị lock cho một context cụ thể không.
     *
     * @param  string  $context  login|actions|billing|all
     */
    public function isLockedFor(string $context): bool
    {
        // 1. Lock trực tiếp trên user này
        $directLocks = $this->activeLocks()->get();

        if ($directLocks->isNotEmpty()) {
            if ($directLocks->contains(fn ($lock) => $lock->type === 'all' || $lock->type === $context)) {
                return true;
            }
        }

        // 2. Nếu là học viên, tôn trọng lock của gia sư chủ
        $ownerTutor = $this->getOwnerTutor();

        if ($ownerTutor && $ownerTutor->id !== $this->id) {
            $tutorLocks = $ownerTutor->activeLocks()->get();

            if ($tutorLocks->contains(fn ($lock) => $lock->type === 'all' || $lock->type === $context)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Scope a query to only include users with a specific role.
     */
    public function scopeRole($query, $role)
    {
        return $query->where('role', $role);
    }

    /**
     * Scope a query to only include active users.
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    /**
     * Get the identifier that will be stored in the subject claim of the JWT.
     */
    public function getJWTIdentifier()
    {
        return $this->getKey();
    }

    /**
     * Return a key value array, containing any custom claims to be added to the JWT.
     */
    public function getJWTCustomClaims()
    {
        return [];
    }

    /**
     * Get the user's default bank account.
     * Ordered by id so an (impossible after the unique index, but pre-existing) duplicate
     * default row resolves deterministically to the oldest one.
     */
    public function bankAccount()
    {
        return $this->hasOne(UserBankAccount::class)->where('is_default', true)->orderBy('id');
    }

    /**
     * Get all bank accounts of the user.
     */
    public function bankAccounts()
    {
        return $this->hasMany(UserBankAccount::class);
    }
}
