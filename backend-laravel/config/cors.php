<?php
return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'https://<YOUR_VERCEL_APP>.vercel.app', // replace after first deploy
    ],
    'allowed_origins_patterns' => [
        '/\.vercel\.app$/', // allow previews
    ],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => false,
];

