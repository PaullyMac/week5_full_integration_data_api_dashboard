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
        // set this to your stable production domain (Vercel auto-assigns one):
        'https://week5-full-integration-data-api-dashboard.vercel.app',
    ],

    // allow ALL preview deploys for this project:
    'allowed_origins_patterns' => [
        '^https:\/\/week5-full-integration-data-api-dashboard-[a-z0-9]+\.vercel\.app$',
    ],
];