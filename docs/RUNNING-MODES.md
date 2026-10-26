# Running modes — which stack am I actually running?

Classly can run in **three completely different ways**. They share one codebase and nothing else:
different runtimes, different databases, different ports, different container names. Mixing them up
is the single most common source of confusion in this repo, so this page is the reference.

**The short answer:** local development uses **no containers at all** by default. If you have never
run a `docker compose` command in this repo, `docker ps` will show nothing named `classly-*`, and
that is correct — not a broken setup.

---

## The three modes at a glance

| | **A. Native local** | **B. Docker local dev** | **C. Docker production** |
|---|---|---|---|
| Command | `bash scripts/dev.sh start` | `docker compose -f docker-compose.dev.yml up -d` | `docker compose -f docker-compose.prod.yml up -d` |
| Runs on | your Mac, directly | your Mac, in Docker | your server, in Docker |
| Containers | **0** | 5 | 5 |
| PHP runtime | ServBay `php artisan serve` | `php artisan serve` in container | FrankenPHP |
| Database | SQLite file | MySQL 8.0 container | MySQL 8.4 container |
| Cache / queue / session | `database` driver | Redis container | Redis container |
| Hot reload | yes | yes (bind-mount + polling) | no (compiled build) |
| Env file | `apps/api/.env` | `.env.docker` | `.env` (server only) |
| Default mode? | **yes** | opt-in | deploy only |

`docker-compose.yml` + `docker-compose.shared.yml` are a **fourth**, unused variant (Traefik-based,
for a clean server). They are **not** the default production target — see the warning in
[`DEPLOY-PROD.md`](DEPLOY-PROD.md).

---

## Why people get confused: ServBay is not Docker

Local development runs on **ServBay**, a native dev environment for macOS (comparable to
Laragon or MAMP). It installs PHP and Node as ordinary programs on disk and runs them directly.
Because it plays the same role as Docker — "spin up my dev environment" — it is easy to assume it
*is* Docker. It is not.

You can see it in the process list. These paths are real folders on the Mac, not images:

```
/Applications/ServBay/package/php/8.4/8.4.18/bin/php   artisan serve --port=8000
/Applications/ServBay/package/php/8.4/8.4.18/bin/php   artisan queue:work --tries=3
```

And the database is a single file, not a server:

```
apps/api/database/database.sqlite
```

So in mode A there is nothing for Docker Desktop to display. **An empty Docker Desktop is the
expected state when developing natively.**

---

## How to tell which mode you are in

Run these three checks. They are unambiguous.

```bash
# 1. Native processes? -> mode A is running
ps -eo command | grep -E 'artisan serve|next' | grep -v grep

# 2. Local containers? -> mode B is running
docker compose -f docker-compose.dev.yml ps

# 3. Server containers? -> mode C is running
ssh classly-prod 'docker ps --filter name=classly'
```

`classly-prod` is an SSH alias you add to `~/.ssh/config` yourself — see
[`DEPLOY-PROD.md`](DEPLOY-PROD.md). Name it after the project, not the machine, so that moving
Classly to another server is a one-line `HostName` change.

Container names alone tell modes B and C apart, because they follow different rules:

```
classly-api-1     trailing "-1"  -> mode B (local dev; Compose auto-names from the project name)
classly-api       no suffix      -> mode C (production; fixed container_name, referenced by nginx)
```

The same split applies to networks and volumes:

| Resource | Mode B (local dev) | Mode C (production) |
|---|---|---|
| Network | `classly-net-dev` | `classly-net` |
| DB volume | `classly_mysql_data` | `classly-mysql-data` |
| Images | `classly-api-dev` | `classly-api:latest` |

Underscores mean Compose generated the name (mode B). Hyphens mean the name was written by hand in
the compose file (mode C).

---

## Port map

No port is shared between modes, so **A and B can run at the same time** without a port collision.
This is deliberate. They do, however, collide over **cookies** — see the warning below.

| Service | A. Native | B. Docker dev | C. Production (server) |
|---|---|---|---|
| API | `8000` | `8200` | `127.0.0.1:8101` (nginx fronts it) |
| App (Next) | `3000` | `3200` | `127.0.0.1:8102` (nginx fronts it) |
| MySQL | — (SQLite) | `3308` | not published |
| Redis | — (`database` driver) | `6579` | not published |

### Trap: modes A and B share one cookie jar

Ports are isolated. **Cookies are not.** Per RFC 6265 a cookie's scope is the *host*, and the port
is not part of it — so `localhost:3000` (native) and `localhost:3200` (Docker dev) read and write
**the same cookies**. Each stack has its own `JWT_SECRET`, so a session issued by one is garbage to
the other.

Until this was fixed, the failure was not a clean "please log in" but an **infinite redirect loop**:

```
middleware.ts:102   isAuthenticated = !!token      only checks the cookie EXISTS, never that it is valid
middleware.ts:111   cookie present + hits /auth/sign-in  -> redirect to /dashboard
core.ts             API answers 401                      -> redirect to /auth/sign-in
                                                         -> repeat forever
```

The middleware trusts the cookie's presence; the client trusts the API's answer. They disagree, and
the page reloads endlessly. Symptom in the container log:

```
GET  /dashboard        200
GET  /api/auth/token   200      cookie is there, token handed to the client
GET  /api/classes      401      the API rejects it (signed with the other stack's secret)
POST /api/auth/refresh 429      refresh is rate-limited, so it cannot recover
GET  /dashboard        200      loop
```

**Fixed:** `autoRedirectIfUnauthenticated` now clears the session server-side before navigating.
The cookie is HttpOnly, so client JavaScript cannot delete it — the client calls
`POST /api/auth/logout` and waits for it to finish, because redirecting first would cancel the
request in flight and leave the bad cookie exactly where it was. That route always clears cookies
and always answers 200, even when the backend rejects the token, since an expired token is the most
common reason anyone logs out. A single-flight guard stops a dashboard's parallel requests from each
firing their own logout.

This mattered beyond Docker: any event invalidating an existing token — rotating `JWT_SECRET`,
restoring a different database — produced the same loop in production.

**Still recommended:** browse mode B at **`http://127.0.0.1:3200`**. `127.0.0.1` and `localhost` are
different hosts for cookie purposes, so each stack keeps its own jar and the two stop logging each
other out every time you switch.

### About the `8000` inside production containers

`docker ps` on the server shows `8000/tcp` on `classly-api` and `classly-queue`. That is a
**container-internal** port living inside the `classly-net` bridge network — it is not bound on the
host. The host binding is `127.0.0.1:8101->8000/tcp`. Two containers on different networks can both
use port 8000 with no conflict, the same way two buildings can both have a room 101.

Verified host ports on the production server:

```
:80, :443   nginx
:8101       classly-api
:8102       classly-app
:8888       obe_system_web     (a different project on the same server)
:3000       PM2                (a different project)
:5432       obe_system_db      (a different project)
```

Nothing listens on `:8000`.

---

## Mode A — native local (the default)

```bash
bash scripts/dev.sh setup     # once: install deps, create .env, migrate + seed SQLite
bash scripts/dev.sh start     # api + queue + app
bash scripts/dev.sh status
bash scripts/dev.sh verify    # end-to-end health checks
bash scripts/dev.sh stop
```

Requires PHP ≥8.4 and Node ≥20 on the host (ServBay provides both). No MySQL or Redis needed.

---

## Mode B — Docker local dev

Use this when you want local development to mirror production infrastructure (MySQL and Redis
instead of SQLite and the `database` driver), or to reproduce a bug that only appears with real
MySQL.

```bash
cp .env.docker.example .env.docker    # then fill APP_KEY and JWT_SECRET
docker compose -f docker-compose.dev.yml up -d --build
docker compose -f docker-compose.dev.yml ps
docker compose -f docker-compose.dev.yml logs -f api
docker compose -f docker-compose.dev.yml down          # stop, keep data
docker compose -f docker-compose.dev.yml down -v       # stop and wipe MySQL/Redis data
```

Generating the two secrets:

```bash
openssl rand -base64 32 | sed 's/^/APP_KEY=base64:/'
openssl rand -hex 32    | sed 's/^/JWT_SECRET=/'
```

Endpoints once healthy:

```
http://localhost:8200/up             API health
http://localhost:3200                app (Next.js)
```

### Two traps specific to mode B

**1. `DB_PASSWORD` and `MYSQL_PASSWORD` must be identical.** Compose's `${VAR}` substitution does
**not** read `env_file` — only the project `.env` and the shell. So the MySQL container's
credentials must be set literally in `.env.docker`, not via `${DB_PASSWORD}`. If they drift apart,
MySQL creates user `classly` with one password while Laravel connects with another, and the API
fails with "Access denied". Note that MySQL only creates the user on **first** initialisation:
after changing the password you must run `down -v` to drop the `mysql_data` volume.

**2. Dev services must not have a fixed `container_name`.** The project name (`STACK_NAME`,
default `classly`) already namespaces them, so Compose names them `classly-<service>-1`. Hardcoding
a name would break `--scale` and make a second deployment collide. Reach services by **service
name** instead:

```bash
docker compose -f docker-compose.dev.yml exec api php artisan migrate:status
```

Production is the opposite: it *does* use fixed names, because the nginx config and Traefik routers
reference them.

---

## Mode C — Docker production

Runs behind host nginx. Follow [`DEPLOY-PROD.md`](DEPLOY-PROD.md), which documents the
architecture and the deploy sequence.

> **Never run `docker-compose.shared.yml` on such a host.** It starts Traefik bound to :80/:443,
> which fights host nginx and takes down every other site that nginx serves.

---

## Switching modes

Modes are independent, so switching is just "start the other one". Stopping the previous mode is
optional — the port map guarantees they do not collide — but running fewer things is easier to reason
about.

```bash
# A -> B
bash scripts/dev.sh stop
docker compose -f docker-compose.dev.yml up -d

# B -> A
docker compose -f docker-compose.dev.yml down
bash scripts/dev.sh start
```

**Data does not travel between modes.** Mode A writes to `apps/api/database/database.sqlite`;
mode B writes to the `classly_mysql_data` volume. Seeding one leaves the other untouched. To
reseed the demo dataset in mode B:

```bash
docker compose -f docker-compose.dev.yml exec api \
  php artisan migrate:fresh --seed --force
```

---

## Verified state (2026-08-15)

Mode B was built and brought up from scratch on this machine to confirm this document is accurate:

```
api         Up (healthy)    8200 -> 8000     /up returns 200, 88 tables migrated + seeded
app         Up (healthy)    3200 -> 3000     /auth/sign-in returns 200
queue       Up (healthy)                     shares the api image and the api_vendor volume
mysql       Up (healthy)    3308 -> 3306     MySQL 8.0
redis       Up (healthy)    6579 -> 6379     Redis 7
```

The BFF chain was exercised end to end: `POST localhost:3200/api/auth/login` returned 200 and set
`auth_token` / `refresh_token` as HttpOnly cookies, with no token in the response body — the token
never reaches client JavaScript, which is the whole point of the BFF boundary.

Mode A kept running throughout on ports 8000 and 3002, unaffected.
