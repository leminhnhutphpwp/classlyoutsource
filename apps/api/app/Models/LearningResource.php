<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class LearningResource extends Model
{
    use \App\Traits\HasHashId, HasFactory, SoftDeletes;

    protected $fillable = [
        'tutor_id',
        'media_id',
        'title',
        'description',
        'type',
        'subject_id',
        'subject',
        'topic',
        'grade_level_id',
        'grade_level',
        'tags',
        'external_url',
        'downloads',
        'views',
        'is_public',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'tags' => 'array',
            'downloads' => 'integer',
            'views' => 'integer',
            'is_public' => 'boolean',
        ];
    }

    public function tutor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'tutor_id');
    }

    /**
     * Get the subject of the resource.
     */
    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    /**
     * Get the grade level of the resource.
     */
    public function gradeLevel(): BelongsTo
    {
        return $this->belongsTo(GradeLevel::class);
    }

    /**
     * Get the media file (Media) - primary media.
     */
    public function media(): BelongsTo
    {
        return $this->belongsTo(Media::class);
    }

    /**
     * Get all media files for this resource (for multiple images).
     */
    public function mediaFiles(): BelongsToMany
    {
        return $this->belongsToMany(Media::class, 'learning_resource_media')
            ->withPivot('order')
            ->withTimestamps()
            ->orderBy('learning_resource_media.order');
    }

    /**
     * Get assignments using this resource.
     */
    public function assignments(): BelongsToMany
    {
        return $this->belongsToMany(Assignment::class, 'assignment_learning_resource')
            ->withPivot('order')
            ->withTimestamps()
            ->orderBy('assignment_learning_resource.order');
    }

    /**
     * Increment download count.
     */
    public function incrementDownloads(): void
    {
        $this->increment('downloads');
    }

    /**
     * Increment view count.
     */
    public function incrementViews(): void
    {
        $this->increment('views');
    }

    /**
     * Check if resource is a file (has media).
     */
    public function isFile(): bool
    {
        return $this->media_id !== null || $this->mediaFiles()->exists();
    }

    /**
     * Check if resource has multiple media files.
     */
    public function hasMultipleMedia(): bool
    {
        return $this->type === 'image' && $this->mediaFiles()->count() > 1;
    }

    /**
     * Check if resource is external link.
     */
    public function isExternalLink(): bool
    {
        return $this->external_url !== null;
    }

    /**
     * Get file download URL (secure endpoint, not direct storage URL).
     * SECURITY: Do not expose direct storage URLs to prevent unauthorized access.
     */
    public function getFileUrl(): ?string
    {
        if (! $this->media_id) {
            return null;
        }

        // Return secure download endpoint (relative path, not absolute URL)
        // Client will append to their base URL
        return "/api/v1/learning-resources/{$this->hash_id}/download";
    }

    /**
     * Get file size formatted.
     */
    public function getFileSizeFormatted(): ?string
    {
        if (! $this->media) {
            return null;
        }

        $bytes = $this->media->size;
        $units = ['B', 'KB', 'MB', 'GB'];
        $power = $bytes > 0 ? floor(log($bytes, 1024)) : 0;

        return number_format($bytes / pow(1024, $power), 2, '.', ',').' '.$units[$power];
    }

    /**
     * Scope: Public resources.
     */
    public function scopePublic($query)
    {
        return $query->where('is_public', true);
    }

    /**
     * Scope: Active resources.
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public function scopeByTutor($query, $tutorId)
    {
        return $query->where('tutor_id', $tutorId);
    }
}
