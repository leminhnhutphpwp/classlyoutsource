<?php

/**
 * Test bootstrap — runs before ANY app boot (phpunit.xml bootstrap).
 *
 * WHY THIS EXISTS: inside Docker containers the services' env_file (e.g.
 * docker-compose.dev.yml → .env.docker) exports APP_ENV=local, DB_CONNECTION=mysql,
 * CACHE_STORE=redis, ... as REAL process environment variables, which land in
 * $_SERVER. Laravel's env() adapter chain prefers $_SERVER over $_ENV, so PHPUnit's
 * <env force="true"> entries (which only write $_ENV + putenv) silently LOSE and the
 * suite would run against the live MySQL/Redis stack instead of the hermetic
 * in-memory SQLite configuration in phpunit.xml.
 *
 * Writing the testing values into $_SERVER as well makes the suite deterministic
 * everywhere — bare host, demo container, or dev compose stack.
 *
 * Must stay in sync with the <php> block in phpunit.xml.
 */

$testingEnv = [
    'APP_ENV' => 'testing',
    'APP_MAINTENANCE_DRIVER' => 'file',
    'BCRYPT_ROUNDS' => '4',
    'CACHE_STORE' => 'array',
    'DB_CONNECTION' => 'sqlite',
    'DB_DATABASE' => ':memory:',
    'JWT_SECRET' => 'testing-secret-key-not-for-production-use-only',
    'CLIENT_SIGNATURE_ENABLED' => 'false',
    'MAIL_MAILER' => 'array',
    'PULSE_ENABLED' => 'false',
    'QUEUE_CONNECTION' => 'sync',
    'SESSION_DRIVER' => 'array',
    'TELESCOPE_ENABLED' => 'false',
];

foreach ($testingEnv as $name => $value) {
    $_SERVER[$name] = $value;
    $_ENV[$name] = $value;
    putenv("$name=$value");
}

// Dotenv must never override the values forced above.
$_SERVER['DOTENV_QUIET'] = '1';

require __DIR__.'/../vendor/autoload.php';
