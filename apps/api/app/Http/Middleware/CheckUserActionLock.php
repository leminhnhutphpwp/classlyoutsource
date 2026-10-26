<?php

namespace App\Http\Middleware;

use App\Models\UserLock;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckUserActionLock
{
    /**
     * Handle an incoming request.
     *
     * Chặn các hành động ghi (POST/PUT/PATCH/DELETE) khi tài khoản đang bị lock dạng actions/all.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = auth('api')->user();

        if (! $user) {
            return $next($request);
        }

        // Ops-fix A: a center-suspended account is locked out of every API call (defense in depth — the
        // primary revoke happens in AuthenticateApi, but this also covers any route resolving auth here).
        if ($user->isLoginBlocked()) {
            return response()->json([
                'success' => false,
                'message' => 'Tài khoản của bạn đã bị trung tâm tạm khóa. Vui lòng liên hệ trung tâm để được hỗ trợ.',
                'code' => 'ACCOUNT_SUSPENDED',
                'force_logout' => true,
            ], 401);
        }

        // Nếu tài khoản đã bị vô hiệu hóa (status = inactive) thì chặn toàn bộ API (kể cả GET)
        if (! $user->isActive()) {
            return response()->json([
                'success' => false,
                'message' => 'Tài khoản đã bị vô hiệu hóa',
                'code' => 'ACCOUNT_INACTIVE',
            ], 403);
        }

        // Nếu là học viên, check gia sư chủ có inactive/suspended không
        if ($user->isStudent()) {
            $ownerTutor = $user->getOwnerTutor();
            if ($ownerTutor && $ownerTutor->id !== $user->id && (! $ownerTutor->isActive() || $ownerTutor->isLoginBlocked())) {
                return response()->json([
                    'success' => false,
                    'message' => 'Tài khoản gia sư của bạn tạm thời không khả dụng. Vui lòng liên hệ hỗ trợ để được hỗ trợ.',
                    'code' => 'TUTOR_INACTIVE',
                ], 403);
            }
        }

        // Check lock type = 'login' hoặc 'all' -> đá user ra khỏi phiên (force logout)
        // Áp dụng cho TẤT CẢ các request (kể cả GET) để đảm bảo user bị đá ra ngay
        if ($user->isLockedFor('login') || $user->isLockedFor('all')) {
            /** @var UserLock|null $lock */
            $lock = $user->activeLocks()->orderByDesc('start_at')->first();

            return response()->json([
                'success' => false,
                'message' => 'Tài khoản đã bị tạm khóa. Vui lòng đăng nhập lại sau.',
                'code' => 'ACCOUNT_LOCKED',
                'force_logout' => true, // Flag để frontend biết cần force logout
                'data' => [
                    'reason' => $lock?->reason,
                    'locked_from' => $lock?->start_at?->toISOString(),
                    'locked_until' => $lock?->end_at?->toISOString(),
                    'type' => $lock?->type,
                ],
            ], 401); // 401 để frontend có thể xử lý như unauthorized và force logout
        }

        // Chỉ áp dụng lock mềm cho các phương thức có thể thay đổi dữ liệu
        // Lock type = 'actions' chỉ chặn POST/PUT/PATCH/DELETE, vẫn cho phép GET
        if (in_array($request->method(), ['GET', 'HEAD', 'OPTIONS'])) {
            return $next($request);
        }

        // Check lock type = 'actions' hoặc 'all' cho các hành động ghi
        if ($user->isLockedFor('actions')) {
            /** @var UserLock|null $lock */
            $lock = $user->activeLocks()->orderByDesc('start_at')->first();

            return response()->json([
                'success' => false,
                'message' => 'Tài khoản đang bị tạm khóa, bạn không thể thực hiện thao tác này',
                'code' => 'ACCOUNT_ACTIONS_LOCKED',
                'data' => [
                    'reason' => $lock?->reason,
                    'locked_from' => $lock?->start_at?->toISOString(),
                    'locked_until' => $lock?->end_at?->toISOString(),
                    'type' => $lock?->type,
                ],
            ], 403);
        }

        return $next($request);
    }
}
