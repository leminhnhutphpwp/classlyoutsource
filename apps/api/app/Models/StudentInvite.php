<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StudentInvite extends Model
{
    use \App\Traits\HasHashId, HasFactory;

    protected $fillable = [
        'user_id',
        'email',
        'name',
        'role',
        'token',
        'status',
        'sent_at',
        'accepted_at',
        'expires_at',
        'revoked_at',
        'ip_address',
        'meta',
    ];

    protected $casts = [
        'sent_at' => 'datetime',
        'accepted_at' => 'datetime',
        'expires_at' => 'datetime',
        'revoked_at' => 'datetime',
        'meta' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
