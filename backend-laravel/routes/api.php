<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\PositionController;
use App\Http\Controllers\Api\IntegrationsController;

Route::get('/health', fn () => response()->json(['ok' => true]));

Route::prefix('traccar')->group(function () {
    Route::get('devices',   [IntegrationsController::class, 'traccarDevices']);
    Route::get('positions', [IntegrationsController::class, 'traccarPositions']);
});

Route::get('positions/latest', [PositionController::class, 'latest']);
Route::get('positions',        [PositionController::class, 'index']);

Route::post('predict-eta', [IntegrationsController::class, 'predictEta']);