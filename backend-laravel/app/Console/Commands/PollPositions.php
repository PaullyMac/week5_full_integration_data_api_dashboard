<?php
namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use App\Models\Position;
use App\Models\DeviceLatestPosition;

class PollPositions extends Command
{
    protected $signature = "positions:poll";
    protected $description = "Fetch positions from Flask cache and persist to Postgres";

    public function handle(): int
    {
        $base = rtrim(env("FLASK_BASE_URL", "http://flask:5000"), "/");
        $url  = $base . "/api/traccar/positions";

        $res = Http::timeout(15)->get($url);
        if (!$res->ok()) {
            $this->warn("Flask returned HTTP " . $res->status());
            return self::FAILURE;
        }

        $payload = $res->json();
        $rows = [];
        if (is_array($payload) && !Arr::isAssoc($payload)) {
            $rows = $payload;
        } elseif (is_array($payload) && isset($payload["positions"]) && is_array($payload["positions"])) {
            $rows = $payload["positions"];
        }

        if (empty($rows)) {
            $this->info("No positions received.");
            return self::SUCCESS;
        }

        $now = Carbon::now();
        $toUpsert = [];
        $latestByDevice = [];

        foreach ($rows as $p) {
            $traccarId = (int)($p["id"] ?? 0);
            $deviceId  = (int)($p["deviceId"] ?? 0);
            if ($traccarId <= 0 || $deviceId <= 0) { continue; }

            $fix = isset($p["fixTime"]) ? Carbon::parse($p["fixTime"]) : null;
            $srv = isset($p["serverTime"]) ? Carbon::parse($p["serverTime"]) : null;

            $row = [
                "traccar_id" => $traccarId,
                "device_id"  => $deviceId,
                "fix_time"   => $fix,
                "server_time"=> $srv,
                "latitude"   => isset($p["latitude"])  ? (float)$p["latitude"]  : null,
                "longitude"  => isset($p["longitude"]) ? (float)$p["longitude"] : null,
                "altitude"   => isset($p["altitude"])  ? (float)$p["altitude"]  : null,
                "speed"      => isset($p["speed"])     ? (float)$p["speed"]     : null,
                "course"     => isset($p["course"])    ? (int)$p["course"]      : null,
                "valid"      => (bool)($p["valid"] ?? true),
                "address"    => $p["address"] ?? null,
                "attributes" => $p["attributes"] ?? null,
                "updated_at" => $now,
                "created_at" => $now,
            ];
            $toUpsert[] = $row;

            // Track latest per device by fix_time
            $key = (string)$deviceId;
            $existing = $latestByDevice[$key]["fix_time"] ?? null;
            if (!$existing || ($fix && $fix > $existing)) {
                $latestByDevice[$key] = [
                    "device_id"       => $deviceId,
                    "last_traccar_id" => $traccarId,
                    "fix_time"        => $fix,
                    "latitude"        => $row["latitude"],
                    "longitude"       => $row["longitude"],
                    "altitude"        => $row["altitude"],
                    "speed"           => $row["speed"],
                    "course"          => $row["course"],
                    "valid"           => $row["valid"],
                    "address"         => $row["address"],
                    "attributes"      => $row["attributes"],
                    "updated_at"      => $now,
                    "created_at"      => $now,
                ];
            }
        }

        // Upsert positions on traccar_id
        Position::upsert(
            $toUpsert,
            ["traccar_id"],
            ["device_id","fix_time","server_time","latitude","longitude","altitude","speed","course","valid","address","attributes","updated_at"]
        );

        // Upsert latest per device
        DeviceLatestPosition::upsert(
            array_values($latestByDevice),
            ["device_id"],
            ["last_traccar_id","fix_time","latitude","longitude","altitude","speed","course","valid","address","attributes","updated_at"]
        );

        $this->info("Persisted ".count($toUpsert)." positions; updated ".count($latestByDevice)." device latest.");
        return self::SUCCESS;
    }
}
