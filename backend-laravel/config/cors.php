<?php
// backend-laravel/config/cors.php
return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => array_map('trim', explode(',', env('CORS_ALLOWED_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000'))),
    // allow any https://<anything>.vercel.app preview:
    'allowed_origins_patterns' => ['#^https://[a-z0-9-]+\.vercel\.app$#i'],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => false,
];