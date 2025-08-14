<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class Integrations
{
    private string $flaskBase;
    private string $traccarBase;
    private string $traccarUser;
    private string $traccarPass;

    public function __construct()
    {
        $this->flaskBase   = rtrim(config('services.flask.base_url'), '/');
        $this->traccarBase = rtrim(config('services.traccar.base_url'), '/');
        $this->traccarUser = config('services.traccar.user');
        $this->traccarPass = config('services.traccar.pass');
    }

    public function flaskHealth(): array
    {
        $res = Http::timeout(10)->get("{$this->flaskBase}/api/health");
        return $res->json();
    }

    public function predictEta(array $payload): array
    {
        return Http::timeout(15)
            ->asJson()
            ->post("{$this->flaskBase}/api/predict_eta", $payload)
            ->throw()
            ->json();
    }

    public function traccarDevices(): array
    {
        $res = Http::timeout(10)
            ->withBasicAuth($this->traccarUser, $this->traccarPass)
            ->get("{$this->traccarBase}/api/devices");
        return $res->json();
    }

    public function traccarPositions(?int $deviceId = null): array
    {
        $query = [];
        if ($deviceId) $query['deviceId'] = $deviceId;

        $res = Http::timeout(10)
            ->withBasicAuth($this->traccarUser, $this->traccarPass)
            ->get("{$this->traccarBase}/api/positions", $query);

        return $res->json();
    }
}