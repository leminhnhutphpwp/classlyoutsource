<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LoginActivity extends Model
{
    use \App\Traits\HasHashId, HasFactory;

    protected $fillable = [
        'user_id',
        'email',
        'is_success',
        'status',
        'ip_address',
        'device_id',
        'device_name',
        'location',
        'user_agent',
        'message',
        'context',
        'logged_in_at',
    ];

    protected $casts = [
        'is_success' => 'boolean',
        'context' => 'array',
        'logged_in_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
