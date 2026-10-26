# CLAUDE.md — apps/api (Laravel 11)

Classly's **only** backend: REST API `/api/v1`, JWT auth, and queue.

## Tests (run these — they guard the hardening work)

```bash
php artisan test                 # feature suite on in-memory SQLite (RefreshDatabase)
php artisan test --filter=Xxx
```

- `tests/TestCase.php` provides `actingAsApi($user)` (real JWT bearer), `tutor()`, `studentInClass()`.
  Models are hashid-bound in routes — build URLs with `$model->hash_id`.
- Access control: every controller reads the caller via `getAuthUser()`/`requireAuth()` (request-scoped,
  never `static` — that leaks identity under Octane). Ownership guards live in `BaseController`:
  `guardClassAccess` / `callerCanViewClass` (reads: owner tutor / enrolled student / super admin) and
  `guardStudentAccess`; mutations use `canManageResource`. They fail CLOSED (404). Add these to any new
  endpoint that takes a hashid — hashids are obfuscation, NOT an authorization boundary.
- Single-tenant: no plan-based limits. `config/fraud.php` is anti-abuse only (session caps, bot shield,
  invite limits). Don't reintroduce a count-limit engine.
- Reports use MySQL-only `DATE_FORMAT`, so the export endpoints can't run on SQLite — unit-test the
  renderer (`App\Services\Reports\CsvExporter`) directly instead. Validation i18n lives in
  `App\Support\ValidationMessageTranslator`.

## Run

```bash
composer install
cp .env.example .env            # if missing
touch database/database.sqlite
php artisan key:generate && php artisan jwt:secret
php artisan migrate --seed
php artisan serve --port=8000   # API + admin at http://localhost:8000
php artisan queue:work          # SEPARATE TERMINAL — required for mail/notifications
```

Health: `curl http://localhost:8000/up` → 200. Root `/` returns a JSON status payload.

## Local vs Prod (key differences)

| | Local (`.env`) | Prod (`.env.production`) |
|---|---|---|
| DB | **SQLite** (`database/database.sqlite`) | MySQL :3306 |
| cache/session/queue | `database` / `file` | `redis` |
| mail | `log` (nothing sent) | SMTP |
| `CLIENT_SIGNATURE_ENABLED` | `false` | `true` (client request signing on) |
| `APP_DEBUG` | `true` | `false` |

The `config/*.php` defaults are already local-friendly (`DB_CONNECTION=sqlite`,
`QUEUE_CONNECTION=database`). You only need a correct `.env`; no MySQL/Redis required for dev.

## Known traps

- **Opcache (ServBay)**: after editing any `config/*.php` you must **restart `php artisan serve`**
  or run `php artisan optimize:clear`, otherwise the server keeps the old config (fake route/config 404s).
- **`env()` returns strings**: when a value feeds arithmetic (e.g. `now()->addMinutes(...)`) cast it
  to `(int)` in `config/*.php`. See `config/jwt.php` (`ttl`, `refresh_ttl`).
- **Queue worker is a separate process**: jobs (mail/notify) hang silently if `queue:work` isn't running.

## Route structure

- `routes/web.php` — mounts the `api/v1` group (Laravel 11 no longer auto-loads `routes/api.php`).
- `routes/api_v1.php` — all v1 endpoints (auth, resources, protected via `AuthenticateApi`).
- Auth: `App\Http\Controllers\API\V1\AuthController` (login/refresh/forgot/reset).
- Middleware stack: `DdosProtection` → `RateLimitApi` → `VerifyClientSignature` → `AuthenticateApi`.

## Config worth knowing

- `config/jwt.php` — token TTLs (cast to int).
- `config/fraud.php` — `client_signature`, session caps, bot shield, invite limits.
- `config/hashids.php`, `config/sepay.php` — public ID hashing, payment gateway.

## Admin

Seeded super admin `admin@classly.io.vn` (password from `SEED_ADMIN_PASSWORD`,
otherwise random and printed by the seeder).

