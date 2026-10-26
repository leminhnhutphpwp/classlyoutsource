# Classly

Monorepo: **1 API (Laravel) + 1 app (Next.js)**.

```
apps/api        Laravel 11   REST /api/v1, JWT auth, queue
apps/app        Next.js 15   main app (login), BFF route handlers
```

## How this runs

There are three separate ways to run Classly. Read
**[`docs/RUNNING-MODES.md`](docs/RUNNING-MODES.md)** before you wonder why something is missing.

| | Command | Containers | Database |
|---|---|---|---|
| **Native local** (default) | `bash scripts/dev.sh start` | **none** | SQLite file |
| **Docker local dev** | `docker compose -f docker-compose.dev.yml up -d` | 5 | MySQL 8.0 |
| **Docker production** | see [`docs/DEPLOY-PROD.md`](docs/DEPLOY-PROD.md) | 5 | MySQL 8.4 |

Local development is **native by default — it uses no Docker at all**. An empty Docker Desktop while
developing locally is the expected state, not a broken setup.

## Quick start (native)

```bash
# Requires PHP >=8.4 + Composer, Node >=20
bash scripts/dev.sh setup     # once: install deps for both apps, .env, migrate + seed (SQLite)
bash scripts/dev.sh start     # api + queue + app
bash scripts/dev.sh verify    # end-to-end health checks
bash scripts/dev.sh status    # also: logs, stop, restart
```

- API health: http://localhost:8000/up
- App: http://localhost:3000
- Seeded admin: `admin@classly.io.vn` — password from `SEED_ADMIN_PASSWORD`, or a random one printed by the seeder
- Every command in detail: `scripts/README.md`

## Quick start (Docker local dev)

Use this when you want local infrastructure to mirror production — real MySQL and Redis instead of
SQLite and the `database` driver.

```bash
cp .env.docker.example .env.docker    # then fill APP_KEY and JWT_SECRET
docker compose -f docker-compose.dev.yml up -d --build
```

- API: http://localhost:8200/up · App: http://localhost:3200
- Ports are deliberately offset from the native stack, so both can run at once.

## Ports

| Service | Native | Docker dev | Production |
|---|---|---|---|
| API | 8000 | 8200 | `127.0.0.1:8101` behind nginx |
| App | 3000 | 3200 | `127.0.0.1:8102` behind nginx |
| MySQL | — | 3308 | not published |
| Redis | — | 6579 | not published |

## Deploying

Production runs `docker-compose.prod.yml` behind host nginx — follow
[`docs/DEPLOY-PROD.md`](docs/DEPLOY-PROD.md).

> `docker-compose.yml` + `docker-compose.shared.yml` target a *clean* server using Traefik and are
> **not** the default. Never start the shared stack on a host whose nginx already serves sites:
> its Traefik binds :80/:443 and would take those sites down.

Resource names are project-scoped (`classly-*`) so several projects can share one server; genuinely
shared services (proxy/MySQL/Redis) keep common names.

## Documentation

- [`docs/RUNNING-MODES.md`](docs/RUNNING-MODES.md) — the three ways to run this, and how to tell them apart.
- `CLAUDE.md` — architecture and conventions (read before changing code).
- `apps/*/CLAUDE.md` — per-app detail.
- [`docs/DEPLOY-PROD.md`](docs/DEPLOY-PROD.md) — production runbook (host nginx + `docker-compose.prod.yml`).

## Environment

The app has **exactly one switch variable** pointing at the backend: `BACKEND_URL`. Only `*.example`
files are committed; real secrets live in gitignored files (`apps/api/.env`, `.env.docker`, `.env`,
`.env.production`).

## License

[MIT](LICENSE)
