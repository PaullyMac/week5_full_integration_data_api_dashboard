<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\TraccarController;
use App\Http\Controllers\PositionController;

Route::get('/traccar/devices', [TraccarController::class, 'devices']);
Route::get('/traccar/positions', [TraccarController::class, 'positions']);
Route::get("/positions/latest",  [PositionController::class, "latest"]);
Route::get("/positions",         [PositionController::class, "index"]);

