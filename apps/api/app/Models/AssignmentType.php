<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class AssignmentType extends Model
{
    use \App\Traits\HasHashId, HasFactory, SoftDeletes;

    protected $fillable = [
        'created_by',
        'name',
        'code',
        'description',
        'is_active',
        'order',
    ];

    protected $casts = [
        'created_by' => 'integer',
        'is_active' => 'boolean',
        'order' => 'integer',
    ];

    /**
     * The user who created this assignment type
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get all assignments of this type
     */
    public function assignments(): HasMany
    {
        return $this->hasMany(Assignment::class, 'assignment_type_id');
    }

    /**
     * Scope to only active types
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope to order by order then name
     */
    public function scopeOrdered($query)
    {
        return $query->orderBy('order')->orderBy('name');
    }

    /**
     * Get display name with code
     */
    public function getDisplayNameAttribute(): string
    {
        return $this->code ? "{$this->name} ({$this->code})" : $this->name;
    }
}
