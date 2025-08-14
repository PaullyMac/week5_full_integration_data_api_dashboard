<?php
return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => false,

    // exact origins (dev + stable prod)
    'allowed_origins' => [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        // your stable Vercel domain for this project (not the changing previews):
        'https://week5-full-integration-data-api-dashboard.vercel.app',
    ],

    // ✅ allow ALL Vercel preview URLs for this project (note the /…/ regex)
    'allowed_origins_patterns' => [
        '/^https:\/\/week5-full-integration-data-api-dashboard-[a-z0-9]+\.vercel\.app$/',
    ],
];