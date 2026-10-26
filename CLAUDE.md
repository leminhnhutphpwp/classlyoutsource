# CLAUDE.md — Classly monorepo

Guidance for AI agents working in this repo. **Read this before changing code.**
Each app also has its own `CLAUDE.md` — read the one inside the app folder before editing that app.

## Architecture

Monorepo of **1 backend + 1 frontend**, run locally **without Docker** (native ports).

> **Three run modes, don't mix them up.** Local dev is native (ServBay, no containers at all);
> `docker-compose.dev.yml` is an opt-in local Docker stack on offset ports; production runs behind
> host nginx. Container names, ports, and databases differ in all three.
> See **`docs/RUNNING-MODES.md`** — read it before debugging "where did my container go".

```
browser
  └── apps/app        Next.js 15 (App Router)  :3000  — main app, has login
         └─ BFF: src/app/api/* route handlers call Laravel server-side
                    │
                    ▼
       apps/api      Laravel 11 (PHP ≥8.4)      :8000  — REST API /api/v1, JWT auth, queue
                     └─ local: SQLite + queue/cache/session = database
                        prod : MySQL :3306 + Redis :6379
```

Core principles (keep these when editing):
1. **The app has exactly one switch variable pointing to the backend** — `BACKEND_URL`. Never scatter URLs.
2. **BFF at the dev server** → the browser only makes same-origin calls → **no CORS** in dev.
3. **Clear process separation**: api serve + queue worker + the app process.

## Auth

- **Stateless JWT bearer tokens** (`tymon/jwt-auth`) — **NOT** Sanctum cookies/sessions.
- Access token (`JWT_TTL`, default 60 min) + refresh token (`JWT_REFRESH_TTL`, default 20160 min).
- The app stores tokens server-side (HttpOnly cookie via the BFF) and sends `Authorization: Bearer`
  when the route handler calls Laravel.

## Run locally

Use the dev manager (`scripts/dev.sh`), which manages host processes with PID/log tracking:

```bash
bash scripts/dev.sh setup       # one-time: deps + .env + migrate & seed (SQLite)
bash scripts/dev.sh start       # start all: api + queue + app
bash scripts/dev.sh status      # what's running
bash scripts/dev.sh verify      # end-to-end health checks
bash scripts/dev.sh logs app    # tail a service log
bash scripts/dev.sh restart api # restart one service (also clears opcache flakiness)
bash scripts/dev.sh stop        # stop everything
```

`npm run <setup|dev|status|verify|stop|...>` are thin aliases to the same manager.
Ports: api `:8000` · app `:3000`.

**This mode starts zero containers.** PHP and Node run directly from ServBay
(`/Applications/ServBay/package/...`), and the database is the file
`apps/api/database/database.sqlite`. ServBay looks like Docker in purpose but is native, like
Laragon or MAMP — so `docker ps` showing nothing `classly-*` is correct here, not a broken setup.
If you want containers locally, that's the opt-in stack below.
Backend health: `curl http://localhost:8000/up` → 200.
Default seeded admin: `admin@classly.io.vn` (password from `SEED_ADMIN_PASSWORD` in `apps/api/.env`, otherwise random and printed by the seeder).

## Conventions that matter

- **Env**: only `*.example` files are committed. Real secrets live in `.env` / `.env.production`
  (gitignored). Local api uses SQLite + the `database` drivers; don't switch local `.env` to prod values.
- **After editing PHP config** while `php artisan serve` is running: **restart the server**
  (ServBay's opcache keeps the old config) or run `php artisan optimize:clear`. Symptom of a stale
  cache: routes/login return a fake 404 that disappears after a clean restart.
- **The queue worker is a separate process**: if you forget it, mail/notifications hang silently.
- **Never guess/brute-force local service passwords** (MySQL, etc.). Local defaults to SQLite.

## Docker (production / many projects on one server)

Local dev is native (no Docker) via `scripts/dev.sh`. Four compose files exist — pick deliberately:

| File | What it is | Status |
|---|---|---|
| `docker-compose.prod.yml` | **Default production stack** — host nginx fronts it, no Traefik | default |
| `docker-compose.dev.yml` | Opt-in **local Docker dev** (offset host ports, hot-reload) | opt-in |
| `docker-compose.yml` | Production for a *clean* server using Traefik | unused |
| `docker-compose.shared.yml` | Shared proxy/MySQL/Redis for the Traefik model | **do not run** |

> On a host whose nginx already serves sites, starting `docker-compose.shared.yml` would bind
> Traefik to :80/:443 and take those sites down.

`docker-compose.dev.yml` needs `.env.docker` (copy from `.env.docker.example`, fill `APP_KEY` +
`JWT_SECRET`). Its host ports are offset on purpose — api `8200`, app `3200`,
mysql `3308`, redis `6579` — so it can run alongside the native stack. Full comparison of all
modes: `docs/RUNNING-MODES.md`.

**Naming rule** (so multiple projects can share one server without clashing):
- **Prod** (`docker-compose.yml`): project-owned resources carry the `classly-` prefix — fixed
  `container_name` (`classly-api/app/queue`, referenced by Traefik + as network alias),
  network `classly-net`, volume `classly-storage`, images `classly-*`, Traefik routers `classly-*`.
- **Dev** (`docker-compose.dev.yml`): NO fixed `container_name` — the project name (`${STACK_NAME:-classly}`)
  already namespaces them (compose auto-names `classly-<service>-1`), which keeps `--scale` and a second
  deployment working. Address services by **service name** (`api`, `mysql`, `redis`); run
  `docker compose -f docker-compose.dev.yml exec api …` (not `docker exec classly-api`).
- **Shared services** (proxy, MySQL, Redis) keep common names (`proxy`, `mysql`, `redis`), defined
  once in `docker-compose.shared.yml`, joined over the `shared` (external) network.
- In Docker, frontends reach the backend by **service name** (`http://classly-api:8000`), not localhost.

```bash
cp .env.example .env                                  # fill in prod secrets
docker compose -f docker-compose.shared.yml up -d     # once per server: proxy + mysql + redis
docker compose up -d --build                          # this project: api + queue + app
```

API = FrankenPHP; app = Next standalone. See `apps/*/Dockerfile` + `apps/*/docker/`.

## Layout

| Path | Stack | Notes |
|---|---|---|
| `apps/api/` | Laravel 11 | The only backend; REST `/api/v1` |
| `apps/app/` | Next.js 15 + React 19 | Main app; BFF route handlers |
| `scripts/setup.sh` | bash | Bootstrap the whole local stack |
| `docker-compose.prod.yml` | compose | **What production runs** (host nginx, no Traefik) |
| `docker-compose.dev.yml` | compose | **Local Docker dev** (offset ports, hot-reload; header explains it) |
| `docker-compose.yml` | compose | Prod for a clean Traefik server — currently unused |
| `docker-compose.shared.yml` | compose | Shared proxy/mysql/redis — **do not run on a host with nginx** |
| `docs/RUNNING-MODES.md` | docs | The three run modes and how to tell them apart |
| `docs/DEPLOY-PROD.md` | docs | Production runbook (host nginx + `docker-compose.prod.yml`) |
