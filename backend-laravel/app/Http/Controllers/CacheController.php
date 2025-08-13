<?php
namespace App\Http\Controllers;

use App\Services\FlaskClient;

class CacheController extends Controller
{
    public function devices(FlaskClient $flask) {
        [$status, $data] = $flask->get("/api/traccar/devices");
        return response()->json($data, $status);
    }

    public function positions(FlaskClient $flask) {
        [$status, $data] = $flask->get("/api/traccar/positions");
        return response()->json($data, $status);
    }
}
