<?php
namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Throwable;
use App\Models\Position;
use App\Models\DeviceLatestPosition;

class PollPositions extends Command
{
    protected $signature = 'positions:poll
        {--source=auto : auto|flask|traccar}
        {--deviceId= : Optional deviceId filter when supported}';

    protected $description = 'Fetch positions (Flask cache preferred, fallback to Traccar) and persist to Postgres';

    private function j($v) {
        return is_null($v) ? null : json_encode($v, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    }

    public function handle(): int
    {
        $started = microtime(true);

        $sourceOpt   = strtolower((string)$this->option('source'));
        $deviceIdOpt = $this->option('deviceId');

        $flaskBase   = rtrim(env('FLASK_BASE_URL', ''), '/');
        $traccarBase = rtrim(env('TRACCAR_BASE_URL', ''), '/');
        $traccarUser = env('TRACCAR_USER', '');
        $traccarPass = env('TRACCAR_PASS', '');

        $deviceId = $deviceIdOpt ?: env('POLL_DEVICE_ID');

        $rows = null;
        $used = null;

        try {
            if ($sourceOpt === 'flask' || ($sourceOpt === 'auto' && $flaskBase !== '')) {
                $rows = $this->fetchFromFlask($flaskBase, $deviceId);
                $used = 'flask';
            }
        } catch (Throwable $e) {
            $this->warn('Flask fetch failed: '.$e->getMessage());
            Log::warning('poll.flask_failed', ['error' => $e->getMessage()]);
        }

        if ($rows === null && ($sourceOpt === 'traccar' || $sourceOpt === 'auto')) {
            try {
                if ($traccarBase && $traccarUser && $traccarPass) {
                    $rows = $this->fetchFromTraccar($traccarBase, $traccarUser, $traccarPass, $deviceId);
                    $used = 'traccar';
                }
            } catch (Throwable $e) {
                $this->warn('Traccar fetch failed: '.$e->getMessage());
                Log::warning('poll.traccar_failed', ['error' => $e->getMessage()]);
            }
        }

        if (!is_array($rows) || empty($rows)) {
            $this->info('No positions received.');
            return self::SUCCESS;
        }

        [$processed, $latestCount] = $this->persist($rows);

        $elapsed = round((microtime(true) - $started) * 1000);
        $this->info("source={$used}; rows={$processed}; latest={$latestCount}; {$elapsed}ms");

        return self::SUCCESS;
    }

    private function fetchFromFlask(string $base, $deviceId): ?array
    {
        $url = $base.'/api/traccar/positions';
        $query = [];
        if ($deviceId) $query['deviceId'] = $deviceId;

        $res = Http::timeout(15)->get($url, $query);
        if (!$res->ok()) {
            throw new \RuntimeException('HTTP '.$res->status());
        }
        $payload = $res->json();

        if (is_array($payload) && !Arr::isAssoc($payload)) return $payload;
        if (is_array($payload) && isset($payload['positions']) && is_array($payload['positions'])) return $payload['positions'];

        return null;
    }

    private function fetchFromTraccar(string $base, string $user, string $pass, $deviceId): ?array
    {
        $url = $base.'/api/positions';
        $query = [];
        if ($deviceId) $query['deviceId'] = $deviceId;

        $res = Http::timeout(15)->withBasicAuth($user, $pass)->get($url, $query);
        if (!$res->ok()) {
            throw new \RuntimeException('HTTP '.$res->status());
        }
        $payload = $res->json();

        if (is_array($payload) && !Arr::isAssoc($payload)) return $payload;
        if (is_array($payload) && isset($payload['positions']) && is_array($payload['positions'])) return $payload['positions'];

        return null;
    }

    private function persist(array $rows): array
    {
        $now = Carbon::now();
        $toUpsert = [];
        $latestByDevice = [];

        foreach ($rows as $p) {
            $traccarId = (int)($p['id'] ?? 0);
            $deviceId  = (int)($p['deviceId'] ?? 0);
            if ($traccarId <= 0 || $deviceId <= 0) continue;

            $fix = isset($p['fixTime']) ? Carbon::parse($p['fixTime']) : null;
            $srv = isset($p['serverTime']) ? Carbon::parse($p['serverTime']) : null;
            
            $row = [
                'traccar_id' => $traccarId,
                'device_id'  => $deviceId,
                'fix_time'   => $fix,
                'server_time'=> $srv,
                'latitude'   => isset($p['latitude'])  ? (float)$p['latitude']  : null,
                'longitude'  => isset($p['longitude']) ? (float)$p['longitude'] : null,
                'altitude'   => isset($p['altitude'])  ? (float)$p['altitude']  : null,
                'speed'      => isset($p['speed'])     ? (float)$p['speed']     : null,
                'course'     => isset($p['course'])    ? (int)$p['course']      : null,
                'valid'      => (bool)($p['valid'] ?? true),
                'address'    => $p['address'] ?? null,
                'attributes' => $this->j($p['attributes'] ?? null),
                'updated_at' => $now,
                'created_at' => $now,
            ];
            $toUpsert[] = $row;

            $key = (string)$deviceId;
            $existing = $latestByDevice[$key]['fix_time'] ?? null;
            if (!$existing || ($fix && $fix > $existing)) {
                $latestByDevice[$key] = [
                    'device_id'       => $deviceId,
                    'last_traccar_id' => $traccarId,
                    'fix_time'        => $fix,
                    'latitude'        => $row['latitude'],
                    'longitude'       => $row['longitude'],
                    'altitude'        => $row['altitude'],
                    'speed'           => $row['speed'],
                    'course'          => $row['course'],
                    'valid'           => $row['valid'],
                    'address'         => $row['address'],
                    'attributes'      => $this->j($p['attributes'] ?? null),
                    'updated_at'      => $now,
                    'created_at'      => $now,
                ];
            }
        }

        // Upsert in chunks to avoid memory spikes
        $processed = 0;
        foreach (array_chunk($toUpsert, 1000) as $chunk) {
            Position::upsert(
                $chunk,
                ['traccar_id'],
                ['device_id','fix_time','server_time','latitude','longitude','altitude','speed','course','valid','address','attributes','updated_at']
            );
            $processed += count($chunk);
        }

        DeviceLatestPosition::upsert(
            array_values($latestByDevice),
            ['device_id'],
            ['last_traccar_id','fix_time','latitude','longitude','altitude','speed','course','valid','address','attributes','updated_at']
        );

        return [$processed, count($latestByDevice)];
    }
}