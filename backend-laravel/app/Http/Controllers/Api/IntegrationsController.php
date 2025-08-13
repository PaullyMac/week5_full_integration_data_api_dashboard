<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Integrations;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class IntegrationsController extends Controller
{
    public function health(Integrations $svc)
    {
        // DB ping
        DB::select('select 1');

        // Flask health
        $flask = $svc->flaskHealth();

        return response()->json([
            'ok'    => true,
            'flask' => $flask,
        ]);
    }

    public function predictEta(Request $r, Integrations $svc)
    {
        $data = $r->validate([
            'current_lat'  => 'required|numeric',
            'current_lng'  => 'required|numeric',
            'dropoff_lat'  => 'required|numeric',
            'dropoff_lng'  => 'required|numeric',
        ]);

        return response()->json($svc->predictEta($data));
    }

    public function traccarDevices(Integrations $svc)
    {
        return response()->json($svc->traccarDevices());
    }

    public function traccarPositions(Request $r, Integrations $svc)
    {
        $deviceId = $r->integer('deviceId') ?: null;
        return response()->json($svc->traccarPositions($deviceId));
    }
}