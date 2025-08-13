<?php

namespace App\Http\Controllers;
use Illuminate\Support\Facades\Http;

class TraccarController extends Controller
{
  public function devices() {
    $base = rtrim(config('services.traccar.base_url'), '/');
    $user = config('services.traccar.user');
    $pass = config('services.traccar.pass');
    $res  = Http::withBasicAuth($user, $pass)->get("$base/api/devices");
    return response()->json($res->json(), $res->status());
  }

  public function positions() {
    $base = rtrim(config('services.traccar.base_url'), '/');
    $user = config('services.traccar.user');
    $pass = config('services.traccar.pass');
    $res  = Http::withBasicAuth($user, $pass)->get("$base/api/positions");
    return response()->json($res->json(), $res->status());
  }
}
