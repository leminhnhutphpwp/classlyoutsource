<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class EmailTemplate extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'subject',
        'body_html',
        'body_text',
        'variables',
        'description',
        'category',
        'is_active',
    ];

    protected $casts = [
        'variables' => 'array',
        'is_active' => 'boolean',
    ];

    /**
     * Boot the model.
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($template) {
            if (empty($template->slug)) {
                $template->slug = Str::slug($template->name);
            }
        });
    }

    /**
     * Get template by slug.
     */
    public static function getBySlug(string $slug): ?self
    {
        return static::where('slug', $slug)
            ->where('is_active', true)
            ->first();
    }

    /**
     * Render template with variables.
     *
     * @param  array  $data  Associative array of variable => value
     * @return array ['subject' => string, 'body_html' => string, 'body_text' => string]
     */
    public function render(array $data): array
    {
        $subject = $this->replaceVariables($this->subject, $data);
        $bodyHtml = $this->replaceVariables($this->body_html, $data);
        $bodyText = $this->replaceVariables($this->body_text, $data);

        return [
            'subject' => $subject,
            'body_html' => $bodyHtml,
            'body_text' => $bodyText,
        ];
    }

    /**
     * Replace variables in content.
     * Supports both {variable} and {{variable}} format.
     */
    protected function replaceVariables(string $content, array $data): string
    {
        foreach ($data as $key => $value) {
            // Convert objects to string representation
            if (is_object($value)) {
                if (method_exists($value, '__toString')) {
                    $value = (string) $value;
                } else {
                    $value = json_encode($value);
                }
            } elseif (is_array($value)) {
                $value = json_encode($value);
            } elseif (is_bool($value)) {
                $value = $value ? 'Có' : 'Không';
            } elseif (is_null($value)) {
                $value = '';
            }

            // Replace {variable} and {{variable}}
            $content = str_replace(['{'.$key.'}', '{{'.$key.'}}'], $value, $content);
        }

        return $content;
    }

    /**
     * Get list of available variables.
     */
    public function getAvailableVariables(): array
    {
        return $this->variables ?? [];
    }

    /**
     * Get formatted variables for display.
     */
    public function getFormattedVariablesAttribute(): string
    {
        if (empty($this->variables)) {
            return 'Không có biến';
        }

        $formatted = [];
        foreach ($this->variables as $var => $description) {
            $formatted[] = '{'.$var.'} - '.$description;
        }

        return implode("\n", $formatted);
    }

    /**
     * Scope to get active templates.
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope to get by category.
     */
    public function scopeCategory($query, string $category)
    {
        return $query->where('category', $category);
    }
}
