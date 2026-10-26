<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class GradeType extends Model
{
    use \App\Traits\HasHashId, HasFactory, SoftDeletes;

    protected $fillable = [
        'created_by',
        'name',
        'code',
        'description',
        'is_active',
        'weight',
        'order',
    ];

    protected $casts = [
        'created_by' => 'integer',
        'is_active' => 'boolean',
        'weight' => 'decimal:2',
        'order' => 'integer',
    ];

    /**
     * The user who created this grade type
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get all grades of this type
     */
    public function grades(): HasMany
    {
        return $this->hasMany(Grade::class, 'grade_type_id');
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
