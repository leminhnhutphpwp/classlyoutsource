<?php

use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json(['message' => 'Classly API Service', 'status' => 'active']);
});

/*
|--------------------------------------------------------------------------
| API Routes (Version 1)
|--------------------------------------------------------------------------
| Laravel 11 doesn't auto-load routes/api.php anymore.
| We load API routes here with 'api' prefix and middleware.
|--------------------------------------------------------------------------
*/

Route::prefix('api/v1')
    ->middleware(['api'])
    ->withoutMiddleware([ValidateCsrfToken::class])
    ->group(function () {
        require base_path('routes/api_v1.php');
    });
