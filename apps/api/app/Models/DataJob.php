<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DataJob extends Model
{
    use \App\Traits\HasHashId, HasFactory;

    protected $fillable = [
        'type',
        'module',
        'user_id',
        'status',
        'file_name',
        'format',
        'total_rows',
        'success_count',
        'failed_count',
        'skipped_count',
        'download_path',
        'message',
        'meta',
        'ip',
        'user_agent',
        'started_at',
        'finished_at',
        'duration_ms',
    ];

    protected $casts = [
        'meta' => 'array',
        'started_at' => 'datetime',
        'finished_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
