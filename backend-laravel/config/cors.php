<?php
return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => false,

    // Stable known origins
    'allowed_origins' => [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'https://week5-full-integration-data-api-dashboard.vercel.app', // stable prod domain
    ],

    // ✅ Allow ALL Vercel preview URLs for THIS project
    'allowed_origins_patterns' => [
        '#^https://week5-full-integration-data-api-dashboard-[a-z0-9]+\.vercel\.app$#',
    ],
];