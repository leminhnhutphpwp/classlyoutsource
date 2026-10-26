<?php

use App\Http\Middleware\VerifySePayWebhook;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->trustProxies(at: [
            '127.0.0.1',
        ]);

        // Fail-closed auth guard for the vendor SePay webhook. The package route
        // (POST /api/sepay/webhook) runs on the `api` group and its controller
        // skips auth when the token is unset; this guard runs first, rejects when
        // no token is configured, and compares tokens in constant time. It is a
        // pass-through for every non-webhook request on the group.
        $middleware->appendToGroup('api', VerifySePayWebhook::class);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->render(function (ModelNotFoundException $e, $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Không tìm thấy tài nguyên.',
                    'code' => 'NOT_FOUND',
                ], 404);
            }
        });

        $exceptions->render(function (NotFoundHttpException $e, $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                // Check if it's a model not found message wrapped in NotFoundHttpException
                if (str_contains($e->getMessage(), 'No query results for model')) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Không tìm thấy tài nguyên.',
                        'code' => 'NOT_FOUND',
                    ], 404);
                }

                return response()->json([
                    'success' => false,
                    'message' => 'Đường dẫn không tồn tại hoặc tài nguyên không tìm thấy.',
                    'code' => 'NOT_FOUND',
                ], 404);
            }
        });

        $wantsJson = fn ($request) => $request->is('api/*') || $request->expectsJson();

        // Validation → the standard envelope ({success,message,errors,code}).
        $exceptions->render(function (ValidationException $e, $request) use ($wantsJson) {
            if ($wantsJson($request)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Dữ liệu không hợp lệ',
                    'errors' => $e->errors(),
                    'code' => 'VALIDATION_ERROR',
                ], 422);
            }
        });

        $exceptions->render(function (AuthenticationException $e, $request) use ($wantsJson) {
            if ($wantsJson($request)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Chưa xác thực. Vui lòng đăng nhập.',
                    'code' => 'UNAUTHENTICATED',
                ], 401);
            }
        });

        $exceptions->render(function (AuthorizationException $e, $request) use ($wantsJson) {
            if ($wantsJson($request)) {
                return response()->json([
                    'success' => false,
                    'message' => $e->getMessage() ?: 'Bạn không có quyền thực hiện hành động này.',
                    'code' => 'FORBIDDEN',
                ], 403);
            }
        });

        // Any other HTTP exception (429, 405, 400, ...) → envelope with its own status.
        $exceptions->render(function (HttpExceptionInterface $e, $request) use ($wantsJson) {
            if ($wantsJson($request)) {
                // Preserve headers like Retry-After (429) / Allow (405) that the exception carries.
                return response()->json([
                    'success' => false,
                    'message' => $e->getMessage() ?: 'Yêu cầu không thể xử lý.',
                    'code' => 'HTTP_ERROR',
                ], $e->getStatusCode(), $e->getHeaders());
            }
        });

        // Uncaught throwable → generic 500 envelope (never leak internals in production).
        $exceptions->render(function (Throwable $e, $request) use ($wantsJson) {
            if ($wantsJson($request)) {
                return response()->json([
                    'success' => false,
                    'message' => config('app.debug') ? $e->getMessage() : 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.',
                    'code' => 'SERVER_ERROR',
                ], 500);
            }
        });
    })->create();
