<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Position;
use App\Models\DeviceLatestPosition;

class PositionController extends Controller
{
    // DB snapshot (already used by your frontend)
    public function latest(Request $request)
    {
        $rows = DeviceLatestPosition::orderByDesc('fix_time')->get();
        return response()->json($rows);
    }

    // History with filters + pagination
    public function index(Request $request)
    {
        $q = Position::query();

        // Basic filters
        if ($request->filled('deviceId'))    $q->where('device_id', (int)$request->input('deviceId'));
        if ($request->filled('valid'))       $q->where('valid', filter_var($request->input('valid'), FILTER_VALIDATE_BOOLEAN));

        // Time range
        if ($request->filled('from'))        $q->where('fix_time', '>=', date('c', strtotime($request->input('from'))));
        if ($request->filled('to'))          $q->where('fix_time', '<=', date('c', strtotime($request->input('to'))));

        // Bounding box (minLat/maxLat/minLng/maxLng)
        if ($request->filled('minLat') && $request->filled('maxLat')) {
            $q->whereBetween('latitude',  [(float)$request->input('minLat'), (float)$request->input('maxLat')]);
        }
        if ($request->filled('minLng') && $request->filled('maxLng')) {
            $q->whereBetween('longitude', [(float)$request->input('minLng'), (float)$request->input('maxLng')]);
        }

        // Speed range
        if ($request->filled('speedMin'))    $q->where('speed', '>=', (float)$request->input('speedMin'));
        if ($request->filled('speedMax'))    $q->where('speed', '<=', (float)$request->input('speedMax'));

        // Pagination
        $limit = (int)($request->input('limit', 200));
        $limit = max(1, min($limit, 2000));   // clamp 1..2000
        $page  = max(1, (int)$request->input('page', 1));

        $q->orderByDesc('fix_time');
        $p = $q->paginate($limit, ['*'], 'page', $page);

        return response()->json([
            'data' => $p->items(),
            'meta' => [
                'total'        => $p->total(),
                'per_page'     => $p->perPage(),
                'current_page' => $p->currentPage(),
                'last_page'    => $p->lastPage(),
                'from'         => $p->firstItem(),
                'to'           => $p->lastItem(),
            ],
        ]);
    }
}
