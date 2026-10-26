<?php

namespace App\Http\Resources;

use App\Models\Media;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

class UserResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        // Get avatar URL from Media if available, otherwise fallback to path
        $avatarUrl = null;
        $avatarMedia = null;

        if ($this->avatar_media_id) {
            $media = Media::find($this->avatar_media_id);
            if ($media) {
                $avatarUrl = $media->url ?? Storage::disk($media->disk ?? 'public')->url($media->path);
                $avatarMedia = [
                    '_id' => User::encodeId($media->id),
                    'url' => $avatarUrl,
                    'path' => $media->path,
                ];
            }
        } elseif ($this->avatar && Storage::disk('public')->exists($this->avatar)) {
            // Fallback to old path-based storage
            $avatarUrl = Storage::disk('public')->url($this->avatar);
        }

        return [
            '_id' => $this->hash_id,
            'name' => $this->name,
            'email' => $this->email,
            'pending_email' => $this->pending_email,
            'email_verified' => $this->email_verified_at !== null,
            'email_verified_at' => $this->email_verified_at?->toISOString(),
            'phone' => $this->phone,
            'avatar' => $avatarUrl,
            'avatar_path' => $this->avatar,
            'avatar_media_id' => $this->avatar_media_id ? User::encodeId($this->avatar_media_id) : null,
            'avatar_media' => $avatarMedia,
            'address' => $this->address,
            'bio' => $this->bio,
            'role' => $this->role,
            // Vai trò trong tổ chức: mọi thành viên trung tâm đều có role='tutor' nên nếu chỉ
            // trả `role`, phía hiển thị không phân biệt được chủ trung tâm / quản lý / kế toán.
            'org_role' => $this->resource->orgRole(),
            'role_label' => $this->getRoleLabel(),
            'status' => $this->status,
            'status_label' => $this->getStatusLabel(),
            'theme_key' => $this->theme_key ?? 'classly-red-white',
            'mode' => $this->mode ?? 'light',
            'is_tutor' => $this->isTutor(),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }

    /**
     * Get status label in Vietnamese.
     */
    protected function getStatusLabel(): string
    {
        return match ($this->status) {
            'active' => 'Đang hoạt động',
            'inactive' => 'Tạm ngưng',
            default => $this->status ?? 'N/A',
        };
    }

    /**
     * Get role label in Vietnamese.
     */
    protected function getRoleLabel(): string
    {
        // Ưu tiên vai trò trong TỔ CHỨC. `users.role` của chủ trung tâm, quản lý học vụ và kế toán
        // đều là 'tutor' (thiết kế organization), nên map thẳng từ cột đó sẽ ra "Giáo viên" cho cả ba.
        // Nhãn phải khớp với AuthController::roleLabelFor() và ORG_ROLE_LABELS phía frontend.
        return match ($this->role) {
            'super_admin' => 'Quản trị hệ thống',
            'admin' => 'Quản trị viên',
            'student' => 'Học viên',
            'parent' => 'Phụ huynh',
            'tutor' => match ($this->resource->orgRole()) {
                'owner' => 'Chủ trung tâm',
                'manager' => 'Quản lý',
                'accountant' => 'Kế toán',
                default => 'Giáo viên',
            },
            default => $this->role ?? 'N/A',
        };
    }
}
