#!/usr/bin/env bash
# scripts/check-ports.sh — Pre-deploy HOST-port conflict check (local native, Docker dev, VPS prod).
#
# Run this ON the machine that will run Classly, BEFORE starting anything. It lists every HOST
# port the repo publishes (all run modes) and flags any already in use by ANOTHER project, so you
# can pick a free port up front instead of hitting an opaque "bind: address already in use".
#
#   bash scripts/check-ports.sh
#
# Port map (host side) — every mode is isolated by design:
#   MODE        PORT(S)                          OVERRIDE ENV VAR
#   ──────────  ────────────────────────────────  ─────────────────────────
#   native      api 8000 · app 3000               CLASSLY_API_PORT / CLASSLY_APP_PORT
#   docker-dev  api 8200 · app 3200               API_DEV_PORT / APP_DEV_PORT
#               mysql 3308 · redis 6579           MYSQL_DEV_PORT / REDIS_DEV_PORT
#   prod        api 127.0.0.1:8101 · app 8102     (fixed — host nginx fronts them)
#   shared      proxy 80, 443 · mysql 3306        (shared infra across projects)
#
# Notes:
#   - 80/443/3306 are SHARED infra (Traefik proxy + shared MySQL). A busy port there may be a
#     *sibling* project — do NOT tear it down; check who holds it and reconfigure instead.
#   - "shared:3306" is only relevant to the Traefik clean-server variant; the docker-dev stack uses 3308.
#   - The native API default is 8000, but that port is frequently taken by other projects on the
#     same machine (another local nginx or PHP server) → set CLASSLY_API_PORT and point
#     the app's BACKEND_URL at the new port (apps/app/.env.local).
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/scripts/lib/common.sh"

# ──────────────────────────────────────────────────
# Port matrix (host side). Overrides read from env, matching dev.sh / docker-compose.dev.yml.
# ──────────────────────────────────────────────────
API_PORT="${CLASSLY_API_PORT:-8000}"
APP_PORT="${CLASSLY_APP_PORT:-3000}"
DEV_API_PORT="${API_DEV_PORT:-8200}"
DEV_APP_PORT="${APP_DEV_PORT:-3200}"
DEV_MYSQL_PORT="${MYSQL_DEV_PORT:-3308}"
DEV_REDIS_PORT="${REDIS_DEV_PORT:-6579}"

# mode | port | purpose
PORTS=(
  "native     | $API_PORT        | Laravel API"
  "native     | $APP_PORT        | Next.js app"
  "docker-dev | $DEV_API_PORT    | Laravel API (container 8000)"
  "docker-dev | $DEV_APP_PORT    | Next.js app (container 3000)"
  "docker-dev | $DEV_MYSQL_PORT  | MySQL 8"
  "docker-dev | $DEV_REDIS_PORT  | Redis 7"
  "prod       | 8101             | classly-api (loopback, nginx fronts it)"
  "prod       | 8102             | classly-app (loopback, nginx fronts it)"
  "shared     | 80               | Traefik proxy (shared infra)"
  "shared     | 443              | Traefik proxy TLS (shared infra)"
  "shared     | 3306             | shared MySQL (Traefik variant only)"
)

print_header "Classly - Host Port Check"

conflict=0
printf "  ${BOLD}%-12s %-12s %-8s %s${RESET}\n" "MODE" "PORT" "STATUS" "HOLDER"
print_line "-"
for entry in "${PORTS[@]}"; do
  mode="${entry%%|*}"; mode="${mode// /}"
  rest="${entry#*| }"
  port="${rest%%|*}"; port="${port// /}"
  purpose="${rest#*| }"
  holder=""
  if command -v ss >/dev/null 2>&1; then
    holder=$(ss -ltnpH "( sport = :$port )" 2>/dev/null | awk '{print $NF}' | paste -sd' ' -)
  elif command -v lsof >/dev/null 2>&1; then
    holder=$(lsof -iTCP:"$port" -sTCP:LISTEN -P -n 2>/dev/null | awk 'NR>1{print $1"("$2")"}' | paste -sd' ' -)
  fi
  if [ -n "$holder" ]; then
    printf "  ${BOLD}%-12s${RESET} %-12s ${RED}%-8s${RESET} %s\n" "$mode" "$port" "IN-USE" "$holder"
    conflict=1
  else
    printf "  ${BOLD}%-12s${RESET} %-12s ${GREEN}%-8s${RESET} %s\n" "$mode" "$port" "free" "-"
  fi
done
echo ""

if [ "$conflict" -ne 0 ]; then
  log_warn "Port conflict detected on this machine."
  log "  - Same Classly stack still running?   docker compose down   /   bash scripts/dev.sh stop"
  log "  - Shared infra (80/443/3306) held by ANOTHER project?  Do NOT tear it down — it is a"
  log "    sibling service.  Reconfigure Classly to a free port instead:"
  log "        native     : CLASSLY_API_PORT=8001 CLASSLY_APP_PORT=3001 bash scripts/dev.sh start"
  log "        docker-dev : API_DEV_PORT=8300 APP_DEV_PORT=3300 docker compose -f docker-compose.dev.yml up -d"
  log "        then point apps/app/.env.local BACKEND_URL at the new API port."
  log_fail "Free the port or override it, then re-run this check."
fi

log_info "All Classly host ports are free — safe to start any mode."
