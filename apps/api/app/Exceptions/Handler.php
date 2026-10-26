<?php

namespace App\Exceptions;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\Routing\Exception\RouteNotFoundException;
use Throwable;

class Handler extends ExceptionHandler
{
    /**
     * The list of the inputs that are never flashed to the session on validation exceptions.
     *
     * @var array<int, string>
     */
    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
    ];

    /**
     * Register the exception handling callbacks for the application.
     */
    public function register(): void
    {
        // Prevent reporting RouteNotFoundException related to login/auth for API requests
        $this->reportable(function (Throwable $e) {
            // Get request from current request context
            try {
                $request = request();
                if ($e instanceof RouteNotFoundException && $request) {
                    // Don't report if it's an API request or related to login route
                    if ($request->is('api/*') || strpos($e->getMessage(), 'login') !== false) {
                        return false; // Don't report this exception to logs
                    }
                }
            } catch (\Exception $ex) {
                // Ignore if request() fails
            }
        });
    }

    /**
     * Convert an authentication exception into a response.
     *
     * @param  Request  $request
     */
    protected function unauthenticated($request, AuthenticationException $exception): Response
    {
        // CRITICAL: Check API request FIRST, before calling ANY method on exception
        // This prevents redirectTo() callback from being invoked for API requests
        if ($request->is('api/*') || $request->expectsJson() || $request->wantsJson()) {
            return response()->json([
                'success' => false,
                'message' => 'Chưa xác thực. Vui lòng đăng nhập.',
                'code' => 'UNAUTHENTICATED',
            ], 401);
        }

        // For web requests, try to redirect but ONLY if redirectTo is explicitly null (not a callback)
        // This prevents calling ApplicationBuilder's redirectTo callback which tries to route('login')
        try {
            // Use reflection to check if redirectTo property exists and is null
            $reflection = new \ReflectionClass($exception);
            if ($reflection->hasProperty('redirectTo')) {
                $property = $reflection->getProperty('redirectTo');
                $property->setAccessible(true);
                $redirectTo = $property->getValue($exception);

                // If redirectTo is a string (not a callback), use it
                if (is_string($redirectTo) && $redirectTo) {
                    return redirect()->guest($redirectTo);
                }

                // If redirectTo is null, check if login route exists
                if ($redirectTo === null) {
                    if (Route::has('login')) {
                        return redirect()->guest(route('login'));
                    }
                }
            }

            // If no redirectTo property or it's a callback, try to call redirectTo() method
            // BUT wrap in try-catch to prevent RouteNotFoundException
            try {
                if (method_exists($exception, 'redirectTo')) {
                    $redirectTo = $exception->redirectTo($request);
                    if (is_string($redirectTo) && $redirectTo) {
                        return redirect()->guest($redirectTo);
                    }
                }
            } catch (RouteNotFoundException $e) {
                // Route doesn't exist - fall through to JSON response
            } catch (\Exception $e) {
                // Any other exception - fall through to JSON response
            }
        } catch (\Exception $e) {
            // Reflection or any other error - fall through to JSON response
        }

        // Fallback: always return JSON response for safety
        return response()->json([
            'success' => false,
            'message' => 'Chưa xác thực. Vui lòng đăng nhập.',
            'code' => 'UNAUTHENTICATED',
        ], 401);
    }

    /**
     * Render an exception into an HTTP response.
     *
     * @param  Request  $request
     *
     * @throws Throwable
     */
    public function render($request, Throwable $e): Response
    {
        // CRITICAL: Handle AuthenticationException BEFORE parent::render()
        // This prevents parent from calling redirectTo() which invokes ApplicationBuilder callback
        if ($e instanceof AuthenticationException) {
            // For API requests, return JSON immediately without calling redirectTo()
            if ($request->is('api/*') || $request->expectsJson() || $request->wantsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Chưa xác thực. Vui lòng đăng nhập.',
                    'code' => 'UNAUTHENTICATED',
                ], 401);
            }

            // For web requests, call unauthenticated() but ensure it handles RouteNotFoundException
            return $this->unauthenticated($request, $e);
        }

        // Handle RouteNotFoundException - this often happens when redirectTo() tries to route('login')
        if ($e instanceof RouteNotFoundException) {
            // If it's an API request or the error mentions login route, return JSON
            if ($request->is('api/*') || $request->expectsJson() || strpos($e->getMessage(), 'login') !== false) {
                return response()->json([
                    'success' => false,
                    'message' => 'Chưa xác thực. Vui lòng đăng nhập.',
                    'code' => 'UNAUTHENTICATED',
                ], 401);
            }
        }

        // Always return JSON for API requests
        if ($request->is('api/*')) {
            return $this->handleApiException($request, $e);
        }

        return parent::render($request, $e);
    }

    /**
     * Handle API exceptions and return JSON response.
     *
     * @param  Request  $request
     */
    protected function handleApiException($request, Throwable $e): Response
    {
        // Handle route not found exceptions (thrown when trying to redirect to non-existent route)
        if ($e instanceof RouteNotFoundException) {
            return response()->json([
                'success' => false,
                'message' => 'Chưa xác thực. Vui lòng đăng nhập.',
                'code' => 'UNAUTHENTICATED',
            ], 401);
        }

        // Handle validation exceptions
        if ($e instanceof ValidationException) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi xác thực dữ liệu',
                'code' => 'VALIDATION_ERROR',
                'errors' => $e->errors(),
            ], 422);
        }

        // Handle authentication exceptions
        if ($e instanceof AuthenticationException) {
            return response()->json([
                'success' => false,
                'message' => 'Chưa xác thực. Vui lòng đăng nhập.',
                'code' => 'UNAUTHENTICATED',
            ], 401);
        }

        // Handle authorization exceptions
        if ($e instanceof AuthorizationException) {
            return response()->json([
                'success' => false,
                'message' => 'Không có quyền truy cập',
                'code' => 'UNAUTHORIZED',
            ], 403);
        }

        // Handle model not found exceptions
        if ($e instanceof ModelNotFoundException) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy tài nguyên',
                'code' => 'NOT_FOUND',
            ], 404);
        }

        // Handle HTTP exceptions
        if ($e instanceof HttpException) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage() ?: 'Đã xảy ra lỗi',
                'code' => 'HTTP_ERROR',
            ], $e->getStatusCode());
        }

        // Handle all other exceptions
        $statusCode = 500;
        if (method_exists($e, 'getStatusCode')) {
            $statusCode = $e->getStatusCode();
        }

        return response()->json([
            'success' => false,
            'message' => config('app.debug')
                ? 'Đã xảy ra lỗi: '.$e->getMessage()
                : 'Đã xảy ra lỗi. Vui lòng thử lại sau.',
            'code' => 'SERVER_ERROR',
            'error' => config('app.debug') ? [
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => explode("\n", $e->getTraceAsString()),
            ] : null,
        ], $statusCode);
    }
}
