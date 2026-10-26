# Scripts — Classly

Unified development and deployment scripts for the Classly monorepo.

## Structure

```
scripts/
├── lib/
│   ├── common.sh      # Shared utilities (colors, logging, prompts)
│   ├── process.sh     # Host process management (PID files, port detection)
│   └── docker.sh      # Docker Compose helpers (project + shared stacks)
├── dev.sh             # Development manager (native, no Docker)
├── deploy.sh          # Production deployment (Docker)
├── migrate.sh         # Database migrations
├── setup.sh           # Wrapper → `dev.sh setup`
└── README.md          # This file
```

## Quick start

### Development (native, SQLite — no MySQL/Redis needed)

```bash
bash scripts/dev.sh setup            # install deps + .env + migrate & seed
bash scripts/dev.sh start            # start all: api + queue + app
bash scripts/dev.sh status           # what's running
bash scripts/dev.sh verify           # end-to-end health checks
bash scripts/dev.sh logs app 100     # tail a service's log
bash scripts/dev.sh restart api      # restart one service
bash scripts/dev.sh stop             # stop everything
```

**No system PHP?** On Linux machines without PHP, `setup`/`start` automatically fall back to a
static PHP 8.4 build downloaded into `scripts/bin/php` — system PHP always wins when present.

Single service:
```bash
bash scripts/dev.sh start api
bash scripts/dev.sh build all        # production build of app
```

### Production deployment (Docker)

```bash
cp .env.example .env                 # fill secrets first
bash scripts/deploy.sh               # default: the prod stack (auto version tag)
bash scripts/deploy.sh v1.2.3        # explicit version
bash scripts/deploy.sh --traefik     # clean-server Traefik variant — see docs/DEPLOY.md
```

The default production target is `docker-compose.prod.yml` behind host **nginx** —
runbook: `docs/DEPLOY-PROD.md`. `deploy.sh --traefik` is only for a brand-new clean server
(`docs/DEPLOY.md`): it starts Traefik + shared MySQL/Redis on `:80/:443/:3306`, so it must never
run on a host that already has a web server.

### Migrations

```bash
bash scripts/migrate.sh              # local (SQLite) migrate
bash scripts/migrate.sh seed         # local migrate + seed
bash scripts/migrate.sh fresh        # local migrate:fresh --seed (destructive)
bash scripts/migrate.sh docker       # migrate in the PRODUCTION container
                                     # (docker-compose.prod.yml — service `api`)
```

### Deploy target matrix

| Command | Stack | When |
|---|---|---|
| `bash scripts/deploy.sh [ver]` | `docker-compose.prod.yml` | **Default.** Self-contained stack (own mysql/redis on `classly-net`), publishes loopback `8101/8102` only — safe on a host whose nginx already serves other sites. |
| `bash scripts/deploy.sh --traefik [ver]` | `docker-compose.yml` + `docker-compose.shared.yml` | Clean server only: starts Traefik + shared MySQL/Redis bound to `:80/:443/:3306`. **Never** on a host with an existing web server. |

## Services

| Service | Port | Managed by | Command |
|---|---|---|---|
| api | 8000* | host | `php artisan serve` |
| queue | — | host | `php artisan queue:work` |
| app | 3000 | host | `next dev` |

\* Default. Machine-local overrides live in `scripts/.env.local` (gitignored, sourced by
`dev.sh`): set `CLASSLY_API_PORT` / `CLASSLY_APP_PORT` there once, e.g. when a sibling
project permanently occupies `:8000` (then point `BACKEND_URL` in `apps/app/.env.local` at the new API port).

In production all five services run as Docker containers (`classly-api/app/queue` +
`classly-mysql`/`classly-redis` on `classly-net`) behind host nginx — no shared stack. The Traefik
clean-server variant additionally uses shared `proxy`/`mysql`/`redis` containers.

## Environment

- Dev: only `.env.example` files are committed; real dev values live in gitignored env files.
  Local API runs on SQLite — no MySQL/Redis required.
- Deploy: fill the root `.env` (see `.env.example`). `deploy.sh` validates required vars:
  `APP_KEY`, `JWT_SECRET`, `DB_PASSWORD`, `REDIS_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `HASHIDS_SALT`,
  and the `*_HOST` domains.

## Logs & PIDs

- Per-service logs: `scripts/logs/<service>/output.log`.
- Tracked PIDs: `scripts/.pids` (both gitignored).

## Troubleshooting

**Port already in use**
```bash
bash scripts/dev.sh stop app         # stop the dev-server on that port
lsof -i :3000                        # or inspect manually
```
If `lsof` shows nothing yet the port is reported busy, the holder belongs to another
user/root (system nginx, Docker proxy, another project) — identify it with
`sudo ss -ltnp 'sport = :8000'`. Prefer moving this project instead of killing it:
set `CLASSLY_API_PORT` / `CLASSLY_APP_PORT` in `scripts/.env.local`
(remember to update `BACKEND_URL` in `apps/app/.env.local` to match).

**API returns fake 404s / login 404**
Stale ServBay opcache. Fix:
```bash
cd apps/api && php artisan optimize:clear
bash scripts/dev.sh restart api
```

**Docker: `shared` network missing**
```bash
docker compose -f docker-compose.shared.yml up -d
```
