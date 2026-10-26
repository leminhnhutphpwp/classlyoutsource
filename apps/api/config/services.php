<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | AI (custom endpoint + model per feature)
    |--------------------------------------------------------------------------
    |
    | Powers AI grading + AI question generation. Transport is raw
    | HTTP via Laravel's Http client — no SDK. AI is OFF by default (fail-safe
    | locally); enable per-environment with AI_ENABLED=true and a real key.
    |
    | Design: one `default` provider + a `features` map that OVERRIDES it per
    | feature (grade|generate). Each provider names a `type` — `anthropic`
    | (Messages API) or `openai` (Chat Completions, also OpenRouter/Together/Azure/
    | local) — plus its own base_url / model / key / version. AiClient resolves a
    | provider per feature: any field the feature sets wins, else it falls back to
    | `default`. Swap model or whole provider by editing env only — no code change.
    |
    */
    'ai' => [
        'enabled' => (bool) env('AI_ENABLED', false),
        'timeout' => (int) env('AI_TIMEOUT', 60),
        'max_retries' => (int) env('AI_MAX_RETRIES', 2),

        // Fallback provider for any feature that doesn't override a given field.
        'default' => [
            'type' => env('AI_TYPE', 'anthropic'),
            'base_url' => env('AI_BASE_URL', 'https://api.anthropic.com'),
            'model' => env('AI_MODEL', 'claude-opus-4-8'),
            'key' => env('ANTHROPIC_API_KEY'),
            // anthropic-version header (ignored by the openai transport).
            'version' => env('AI_ANTHROPIC_VERSION', '2023-06-01'),
        ],

        // Per-feature providers. A null field means "inherit from default". Grading is
        // high-volume + low-difficulty → cheap model; generation is mid-difficulty →
        // a stronger model. Point any feature at a different endpoint/type/key freely.
        'features' => [
            'grade' => [
                'type' => env('AI_GRADE_TYPE'),
                'base_url' => env('AI_GRADE_BASE_URL'),
                'model' => env('AI_GRADE_MODEL', 'claude-haiku-4-5'),
                'key' => env('AI_GRADE_KEY'),
                'version' => env('AI_GRADE_ANTHROPIC_VERSION'),
            ],
            'generate' => [
                'type' => env('AI_GENERATE_TYPE'),
                'base_url' => env('AI_GENERATE_BASE_URL'),
                'model' => env('AI_GENERATE_MODEL', 'claude-sonnet-5'),
                'key' => env('AI_GENERATE_KEY'),
                'version' => env('AI_GENERATE_ANTHROPIC_VERSION'),
            ],
        ],

        // Per-model price in USD per 1,000,000 tokens. Used to compute the
        // estimated_cost stored on each ai_usages row. Swap the model → cost tracks it.
        // '*' is the fallback for any model not listed here.
        'prices' => [
            // Real market USD/1M-token pricing so estimated_cost never under-reports.
            'claude-opus-4-8' => ['input' => 15.00, 'output' => 75.00],
            'claude-sonnet-5' => ['input' => 3.00, 'output' => 15.00],
            'claude-haiku-4-5' => ['input' => 1.00, 'output' => 5.00],
            // Common OpenAI-compatible models (so an openai-typed feature meters accurately).
            'gpt-4o' => ['input' => 2.50, 'output' => 10.00],
            'gpt-4o-mini' => ['input' => 0.15, 'output' => 0.60],
            // Fallback is the most expensive tier so an unknown model can't look cheap.
            '*' => ['input' => 15.00, 'output' => 75.00],
        ],
    ],

];
