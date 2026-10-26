<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class NotificationRecipientLog extends Model
{
    use \App\Traits\HasHashId, HasFactory;

    protected $fillable = [
        'notification_id',
        'user_id',
        'student_id',
        'email',
        'channel',
        'status',
        'attempt',
        'sent_at',
        'error_message',
    ];

    protected $casts = [
        'sent_at' => 'datetime',
        'attempt' => 'integer',
    ];

    public function notification()
    {
        return $this->belongsTo(Notification::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function student()
    {
        return $this->belongsTo(Student::class);
    }
}
