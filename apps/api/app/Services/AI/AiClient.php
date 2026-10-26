<?php

namespace App\Services\AI;

use App\Exceptions\AiException;
use App\Models\AiUsage;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Low-level wrapper around a chat-completions style LLM endpoint (raw HTTP via Laravel's Http
 * client — NO SDK, matching the repo's Notification driver pattern).
 *
 * Provider is resolved PER FEATURE from config('services.ai') (a `default` provider + a
 * `features` override map). Each provider names a transport `type`:
 *  - `anthropic` → POST {base_url}/v1/messages, x-api-key + anthropic-version headers,
 *                  structured output via output_config.format, adaptive thinking optional.
 *  - `openai`    → POST {base_url}/v1/chat/completions, Authorization: Bearer, structured
 *                  output via response_format.json_schema. Covers OpenAI + any compatible
 *                  gateway (OpenRouter/Together/Azure/local).
 *
 * Both transports: force JSON matching $jsonSchema, share retry/backoff + error mapping
 * (429 → rate_limited, 5xx / transport / 4xx → upstream, refusal, empty/non-JSON →
 * invalid_response), and record one AiUsage row per successful call with an estimated cost.
 *
 * @see https://docs.anthropic.com/en/api/messages
 * @see https://platform.openai.com/docs/api-reference/chat
 */
class AiClient
{
    /**
     * Run a structured (JSON) generation.
     *
     * @param  string  $system  System prompt.
     * @param  string  $userPrompt  The user message content.
     * @param  array  $jsonSchema  JSON schema for structured output (object with additionalProperties:false + required).
     * @param  array  $opts  {
     *                       feature?: string (grade|generate — picks the provider + cost bucket),
     *                       model?: string (override the resolved provider model),
     *                       user?: \App\Models\User|int|null,
     *                       subject?: \Illuminate\Database\Eloquent\Model|null,
     *                       max_tokens?: int,
     *                       effort?: 'low'|'medium' (anthropic only),
     *                       thinking?: bool (adaptive thinking, anthropic only),
     *                       }
     * @return array The decoded JSON produced by the model.
     *
     * @throws AiException
     */
    public function generate(string $system, string $userPrompt, array $jsonSchema, array $opts = []): array
    {
        if (! config('services.ai.enabled')) {
            throw AiException::disabled();
        }

        $provider = $this->resolveProvider($opts['feature'] ?? null);
        if (empty($provider['key'])) {
            throw AiException::disabled();
        }

        $model = $opts['model'] ?? $provider['model'];
        $maxTokens = (int) ($opts['max_tokens'] ?? 2048);
        // Non-streaming hard ceiling per the Anthropic guidance we follow.
        $maxTokens = min($maxTokens, 16000);

        return $provider['type'] === 'openai'
            ? $this->generateOpenai($provider, $model, $system, $userPrompt, $jsonSchema, $maxTokens, $opts)
            : $this->generateAnthropic($provider, $model, $system, $userPrompt, $jsonSchema, $maxTokens, $opts);
    }

    /**
     * Resolve the effective provider for a feature. Every field is taken from the feature
     * override if set, else the `default` provider; legacy top-level keys are honored as a
     * last-resort fallback so older config/tests keep working.
     *
     * @return array{type:string,base_url:string,model:?string,key:?string,version:string}
     */
    public function resolveProvider(?string $feature): array
    {
        $default = (array) config('services.ai.default', []);
        $override = $feature ? (array) config("services.ai.features.$feature", []) : [];

        $pick = fn (string $key, $legacy = null) => $override[$key] ?? $default[$key] ?? $legacy;

        $base = (string) $pick('base_url', 'https://api.anthropic.com');

        return [
            'type' => (string) $pick('type', 'anthropic'),
            'base_url' => rtrim($base, '/'),
            'model' => $pick('model', config('services.ai.model')),
            // Legacy fallback: pre-refactor config exposed the key at services.ai.key.
            'key' => $pick('key', config('services.ai.key')),
            'version' => (string) $pick('version', config('services.ai.version', '2023-06-01')),
        ];
    }

    /**
     * Anthropic Messages transport: structured output via output_config.format, optional
     * adaptive thinking; parse the first text block; usage.input_tokens/output_tokens.
     */
    protected function generateAnthropic(array $provider, string $model, string $system, string $userPrompt, array $jsonSchema, int $maxTokens, array $opts): array
    {
        $body = [
            'model' => $model,
            'max_tokens' => $maxTokens,
            'system' => $system,
            'messages' => [
                ['role' => 'user', 'content' => $userPrompt],
            ],
            // Structured outputs: force valid JSON matching our schema (NOT the deprecated top-level output_format).
            'output_config' => [
                'format' => [
                    'type' => 'json_schema',
                    'schema' => $jsonSchema,
                ],
            ],
        ];

        if (! empty($opts['effort'])) {
            $body['output_config']['effort'] = $opts['effort'];
        }

        if (! empty($opts['thinking'])) {
            $body['thinking'] = ['type' => 'adaptive'];
        }

        $response = $this->send(
            $provider,
            fn () => Http::withHeaders([
                'x-api-key' => $provider['key'],
                'anthropic-version' => $provider['version'],
                'content-type' => 'application/json',
            ])
                ->timeout((int) config('services.ai.timeout', 60))
                ->post($provider['base_url'].'/v1/messages', $body),
        );

        $payload = $response->json();

        if (($payload['stop_reason'] ?? null) === 'refusal') {
            Log::channel('single')->warning('[ai] model refused request', ['model' => $model]);
            throw AiException::refusal();
        }

        $json = $this->extractAnthropicJson($payload);

        $usage = $payload['usage'] ?? [];
        $this->recordUsage($model, (int) ($usage['input_tokens'] ?? 0), (int) ($usage['output_tokens'] ?? 0), $opts);

        return $json;
    }

    /**
     * OpenAI Chat Completions transport (and any OpenAI-compatible gateway): structured output
     * via response_format.json_schema (strict); parse choices[0].message.content;
     * usage.prompt_tokens/completion_tokens. No `thinking` is sent for this transport.
     */
    protected function generateOpenai(array $provider, string $model, string $system, string $userPrompt, array $jsonSchema, int $maxTokens, array $opts): array
    {
        $body = [
            'model' => $model,
            'messages' => [
                ['role' => 'system', 'content' => $system],
                ['role' => 'user', 'content' => $userPrompt],
            ],
            'response_format' => [
                'type' => 'json_schema',
                'json_schema' => [
                    'name' => 'result',
                    'schema' => $jsonSchema,
                    'strict' => true,
                ],
            ],
            'max_tokens' => $maxTokens,
        ];

        $response = $this->send(
            $provider,
            fn () => Http::withHeaders([
                'Authorization' => 'Bearer '.$provider['key'],
                'content-type' => 'application/json',
            ])
                ->timeout((int) config('services.ai.timeout', 60))
                ->post($provider['base_url'].'/v1/chat/completions', $body),
        );

        $payload = $response->json();

        $message = $payload['choices'][0]['message'] ?? [];
        if (filled($message['refusal'] ?? null)) {
            Log::channel('single')->warning('[ai] model refused request', ['model' => $model]);
            throw AiException::refusal();
        }

        $json = $this->decodeJson($message['content'] ?? null);

        $usage = $payload['usage'] ?? [];
        $this->recordUsage($model, (int) ($usage['prompt_tokens'] ?? 0), (int) ($usage['completion_tokens'] ?? 0), $opts);

        return $json;
    }

    /**
     * Run the given request closure with limited retries for transport errors / 429 / 5xx.
     * The closure MUST return a Laravel Http Response.
     */
    protected function send(array $provider, callable $doRequest): Response
    {
        $maxRetries = max(0, (int) config('services.ai.max_retries', 2));

        $attempt = 0;
        $last = null;

        while ($attempt <= $maxRetries) {
            try {
                $response = $doRequest();
            } catch (\Throwable $e) {
                // Connection/transport error — retry, then give up.
                $last = $e;
                if ($attempt >= $maxRetries) {
                    throw AiException::upstream($e->getMessage());
                }
                $this->backoff($attempt);
                $attempt++;

                continue;
            }

            $status = $response->status();

            if ($status === 429) {
                if ($attempt >= $maxRetries) {
                    throw AiException::rateLimited();
                }
                $this->backoff($attempt, (int) $response->header('retry-after'));
                $attempt++;

                continue;
            }

            if ($status >= 500) {
                if ($attempt >= $maxRetries) {
                    throw AiException::upstream('HTTP '.$status);
                }
                $this->backoff($attempt);
                $attempt++;

                continue;
            }

            if ($status >= 400) {
                $err = $response->json('error.message') ?? ('HTTP '.$status);
                Log::channel('single')->warning('[ai] request failed', ['status' => $status, 'error' => $err]);
                throw AiException::upstream($err);
            }

            return $response;
        }

        // Unreachable in practice; guards the compiler.
        throw AiException::upstream($last?->getMessage() ?? 'exhausted retries');
    }

    /**
     * Sleep between retries. Skipped in the test environment to keep the suite fast.
     */
    protected function backoff(int $attempt, int $retryAfter = 0): void
    {
        if (app()->environment('testing')) {
            return;
        }

        $seconds = $retryAfter > 0 ? min($retryAfter, 10) : min(2 ** $attempt, 8);
        sleep($seconds);
    }

    /**
     * Pull the first text block out of Anthropic content[] and decode it as JSON.
     */
    protected function extractAnthropicJson(array $payload): array
    {
        $blocks = $payload['content'] ?? [];
        $text = null;
        foreach ($blocks as $block) {
            if (($block['type'] ?? null) === 'text' && isset($block['text'])) {
                $text = $block['text'];
                break;
            }
        }

        return $this->decodeJson($text);
    }

    /**
     * Decode a JSON string produced by the model into an array, or fail with invalid_response.
     */
    protected function decodeJson(?string $text): array
    {
        if ($text === null || $text === '') {
            throw AiException::invalidResponse();
        }

        $decoded = json_decode($text, true);
        if (! is_array($decoded)) {
            throw AiException::invalidResponse();
        }

        return $decoded;
    }

    /**
     * Persist a cost-metering row. Never throws — metering must not break the feature.
     */
    protected function recordUsage(string $model, int $inputTokens, int $outputTokens, array $opts): void
    {
        try {
            $user = $opts['user'] ?? null;
            $userId = $user instanceof Model ? $user->getKey() : (is_numeric($user) ? (int) $user : null);

            // Org pool metering (Ops-fix B): stamp the org that paid for this call. Prefer an explicit
            // opts['organization']; else derive from the caller's active membership. Counting the pool by
            // this column (not by the current member set) keeps the tally immune to member churn.
            $organizationId = null;
            $org = $opts['organization'] ?? null;
            if ($org instanceof Model) {
                $organizationId = $org->getKey();
            } elseif (is_numeric($org)) {
                $organizationId = (int) $org;
            } elseif ($user instanceof User) {
                $organizationId = $user->currentOrganization()?->id;
            }

            $subject = $opts['subject'] ?? null;

            AiUsage::create([
                'user_id' => $userId,
                'organization_id' => $organizationId,
                'feature' => $opts['feature'] ?? 'unknown',
                'model' => $model,
                'input_tokens' => $inputTokens,
                'output_tokens' => $outputTokens,
                'estimated_cost' => $this->estimateCost($model, $inputTokens, $outputTokens),
                'subject_type' => $subject instanceof Model ? $subject->getMorphClass() : null,
                'subject_id' => $subject instanceof Model ? $subject->getKey() : null,
                'created_at' => now(),
            ]);
        } catch (\Throwable $e) {
            Log::channel('single')->warning('[ai] failed to record usage: '.$e->getMessage());
        }
    }

    /**
     * Cost in USD from the per-model price map (per 1M tokens).
     */
    protected function estimateCost(string $model, int $inputTokens, int $outputTokens): float
    {
        $prices = config('services.ai.prices', []);
        $price = $prices[$model] ?? $prices['*'] ?? ['input' => 0, 'output' => 0];

        return round(
            ($inputTokens / 1_000_000) * (float) $price['input']
            + ($outputTokens / 1_000_000) * (float) $price['output'],
            6
        );
    }
}
