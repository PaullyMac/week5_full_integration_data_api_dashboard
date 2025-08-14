<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\PositionController;
use App\Http\Controllers\Api\IntegrationsController;

$vercelAllow = function ($request, $next) {
    $res = $next($request);

    $origin = $request->headers->get('Origin', '');
    $allowedExact = [
        'https://week5-full-integration-data-api-dashboard.vercel.app', // stable
    ];
    $allowedPattern = '/^https:\/\/week5-full-integration-data-api-dashboard-[a-z0-9]+\.vercel\.app$/';

    if ($origin && (\in_array($origin, $allowedExact, true) || preg_match($allowedPattern, $origin))) {
        $res->headers->set('Access-Control-Allow-Origin', $origin);
        $res->headers->set('Vary', 'Origin');
        $res->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        $res->headers->set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    }

    // Handle preflight quickly
    if ($request->getMethod() === 'OPTIONS') {
        $res->setStatusCode(200);
        $res->setContent('');
    }

    return $res;
};

Route::middleware($vercelAllow)->group(function () {
    Route::get('/health', fn () => response()->json(['ok' => true]));

    Route::prefix('traccar')->group(function () {
      Route::get('devices',   [IntegrationsController::class, 'traccarDevices']);
      Route::get('positions', [IntegrationsController::class, 'traccarPositions']);
    });

    Route::get('positions/latest', [PositionController::class, 'latest']);
    Route::get('positions',        [PositionController::class, 'index']);

    Route::post('predict-eta', [IntegrationsController::class, 'predictEta']);
});