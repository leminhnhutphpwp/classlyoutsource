# CI Workflows

`ci.yml` runs on every `push` and `pull_request` (any branch). It has two
independent, parallel jobs — one per app in the monorepo. There is no root
workspace manager, so each app is built/tested on its own.

In-flight runs for the same ref are cancelled (`concurrency`) to save minutes.

## Jobs

### `api` — Laravel 11 (PHP 8.4)
- Sets up PHP 8.4 (`shivammathur/setup-php@v2`) with the extensions Laravel +
  intervention/image need: `mbstring, pdo_sqlite, sqlite3, bcmath,
  gd, zip, intl, exif, pcntl`. Coverage is disabled.
- Caches composer downloads keyed on `composer.lock`.
- `composer install --no-interaction --prefer-dist --no-progress`.
- Prepares env: `cp .env.example .env`, `php artisan key:generate`,
  `php artisan jwt:secret --force`. `phpunit.xml` overrides the DB to SQLite
  `:memory:` and injects a testing `JWT_SECRET`, so the suite is self-contained;
  the generated `APP_KEY`/`JWT_SECRET` only exist so `php artisan` can boot.
- Runs `php artisan test` (feature suite on in-memory SQLite).
- Runs `./vendor/bin/pint --test` as a **non-blocking** style check
  (`continue-on-error: true`) — surfaced but does not fail the build, since the
  existing codebase may not be fully Pint-clean.

### `app` — Next.js 15
- Node 20, npm cache keyed on `apps/app/package-lock.json`.
- `npm ci`, then `cp .env.example .env.local` to supply build-time env
  (`BACKEND_URL`, `API_BASE_URL`, `NEXT_PUBLIC_*`), then `npm run build`.
- Uses `output: 'standalone'`. The app is a BFF — no client-side secrets are
  required, so localhost placeholders from `.env.example` are enough to build.

## Secrets
None are required for CI. Both builds succeed with the committed
`.env.example` placeholders (localhost URLs). No real credentials are used or
needed. If production build values are ever required, add them as GitHub
Actions secrets and wire them into the relevant `Prepare environment` step.

## Run the equivalents locally

```bash
# api
cd apps/api
composer install
cp .env.example .env && php artisan key:generate && php artisan jwt:secret
php artisan test
./vendor/bin/pint --test   # style check (optional)

# app
cd apps/app
npm ci
cp .env.example .env.local
npm run build
```
