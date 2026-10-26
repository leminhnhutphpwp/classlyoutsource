<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class GradeLevel extends Model
{
    use \App\Traits\HasHashId, HasFactory, SoftDeletes;

    protected $fillable = [
        'created_by',
        'name',
        'code',
        'description',
        'is_active',
        'level',
        'group',
        'order',
    ];

    protected $casts = [
        'created_by' => 'integer',
        'is_active' => 'boolean',
        'level' => 'integer',
        'order' => 'integer',
    ];

    /**
     * The user who created this grade level
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Scope to get only active grade levels
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope to order by name
     */
    public function scopeOrdered($query)
    {
        return $query->orderBy('order')->orderBy('name');
    }

    /**
     * Get display name with level
     */
    public function getDisplayNameAttribute(): string
    {
        return $this->name;
    }

    /**
     * Get level label
     */
    public function getLevelLabelAttribute(): string
    {
        return match ($this->group) {
            'primary' => 'Tiểu học',
            'secondary' => 'Trung học cơ sở',
            'high_school' => 'Trung học phổ thông',
            'university' => 'Đại học',
            'adult' => 'Người lớn',
            default => 'Khác',
        };
    }
}
