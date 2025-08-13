<?php
namespace App\Services;
use Illuminate\Support\Facades\Http;

class FlaskClient {
    private string $base;
    public function __construct() {
        $this->base = rtrim(env("FLASK_BASE_URL", "http://flask:5000"), "/");
    }
    public function get(string $path): array {
        $res  = Http::timeout(10)->get($this->base . $path);
        $json = $res->json();
        if (!is_array($json)) { $json = is_array($json["positions"] ?? null) ? $json["positions"] : []; }
        return [$res->status(), $json];
    }
}
