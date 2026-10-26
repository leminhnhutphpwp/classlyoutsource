#!/usr/bin/env bash
# scripts/dev.sh — Unified Development Manager (Classly monorepo, native local)
# Usage: bash scripts/dev.sh <command> [service] [arg]
# -------------------------------------------------------------------
set -eo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/scripts/lib/common.sh"
source "$ROOT/scripts/lib/process.sh"

# ── PHP toolchain ─────────────────────────────────────────────────────────
# Prefer system PHP; if absent (e.g. a Linux box without PHP), fall back to the
# repo-local static build in scripts/bin/php (downloaded by `dev.sh setup`).
resolve_php() {
  command -v php >/dev/null 2>&1 && return 0
  if [ -x "$ROOT/scripts/bin/php" ]; then
    export PATH="$ROOT/scripts/bin:$PATH"
    return 0
  fi
  return 1
}

ensure_php() {
  resolve_php && return 0
  local arch; arch="$(uname -m)"
  case "$arch" in
    x86_64|aarch64) ;;
    *) log_fail "unsupported arch '$arch' for the static PHP fallback — install PHP 8.4 manually" ;;
  esac
  local url="https://dl.static-php.dev/static-php-cli/common/php-8.4.23-cli-linux-${arch}.tar.gz"
  print_step "no system PHP — downloading static PHP 8.4 → scripts/bin/"
  mkdir -p "$ROOT/scripts/bin"
  curl -fL --retry 3 --silent --show-error -o "$ROOT/scripts/bin/.spc.tar.gz" "$url" \
    || log_fail "download failed ($url) — install PHP 8.4 manually and retry"
  tar -xzf "$ROOT/scripts/bin/.spc.tar.gz" -C "$ROOT/scripts/bin" \
    && rm -f "$ROOT/scripts/bin/.spc.tar.gz" && chmod +x "$ROOT/scripts/bin/php"
  export PATH="$ROOT/scripts/bin:$PATH"
  log_info "static PHP ready: $("$ROOT/scripts/bin/php" -r 'echo PHP_VERSION;')"
}

# Default ports — overridable per-machine via env so a sibling project can't force you
# to edit the script when 8000/3000 are already taken (e.g. `CLASSLY_API_PORT=8001 bash scripts/dev.sh start`).
# Precedence: explicit env var > scripts/.env.local (gitignored, sourced below) > built-in default.
_local_env_api="${CLASSLY_API_PORT:-}"
_local_env_app="${CLASSLY_APP_PORT:-}"
if [ -f "$ROOT/scripts/.env.local" ]; then
  # shellcheck disable=SC1091
  . "$ROOT/scripts/.env.local"
fi
[ -n "$_local_env_api" ] && export CLASSLY_API_PORT="$_local_env_api"
[ -n "$_local_env_app" ] && export CLASSLY_APP_PORT="$_local_env_app"
unset _local_env_api _local_env_app
API_PORT="${CLASSLY_API_PORT:-8000}"
APP_PORT="${CLASSLY_APP_PORT:-3000}"

CMD="${1:-status}"
SERVICE="${2:-all}"
ARG="${3:-}"

SERVICES="api queue app"

get_service_dir() {
  case "$1" in
    api)       echo "$ROOT/apps/api" ;;
    queue)     echo "$ROOT/apps/api" ;;
    app)       echo "$ROOT/apps/app" ;;
  esac
}

get_service_port() {
  case "$1" in
    api)       echo "$API_PORT" ;;
    app)       echo "$APP_PORT" ;;
    queue)     echo "-" ;;
  esac
}

# ──────────────────────────────────────────────────
# Setup
# ──────────────────────────────────────────────────
do_setup() {
  print_header "Classly - Setup"
  ensure_php
  command -v node >/dev/null 2>&1 || log_fail "node is not installed / not in PATH"
  command -v npm  >/dev/null 2>&1 || log_fail "npm is not installed / not in PATH"

  print_step "apps/api (Laravel, SQLite)"
  cd "$ROOT/apps/api"
  if [ -d vendor ]; then
    log_info "vendor/ already present — skipping composer install"
  else
    command -v composer >/dev/null 2>&1 || log_fail "composer is not installed and vendor/ is missing"
    composer install --no-interaction --prefer-dist
  fi
  [ -f .env ] || cp .env.example .env
  touch database/database.sqlite
  grep -q '^APP_KEY=base64:' .env || php artisan key:generate --force
  grep -q '^JWT_SECRET=.\+' .env || php artisan jwt:secret --force
  php artisan migrate --seed --force
  php artisan optimize:clear
  log_info "api ready"

  print_step "apps/app (Next.js)"
  cd "$ROOT/apps/app"
  [ -f .env.local ] || cp .env.example .env.local
  npm install --silent
  log_info "app deps installed"

  print_step "root tooling"
  cd "$ROOT" && npm install --silent
  log_info "root deps installed"

  echo ""; print_line "="
  log_info "Setup complete — start with: bash scripts/dev.sh start"
  print_line "="
}

# ──────────────────────────────────────────────────
# Start
# ──────────────────────────────────────────────────
ensure_php   # system php, else repo-local scripts/bin/php (auto-download if missing)

start_one() {
  local service="$1"
  local dir port; dir=$(get_service_dir "$service"); port=$(get_service_port "$service")
  local status; status=$(get_process_status "$service" "$port")
  if [[ "$status" == running* ]]; then
    log_warn "$service already $status"
    return 0
  fi
  case "$service" in
    api)       start_process api       "$dir" "$port" php artisan serve --port="$port" ;;
    queue)     start_process queue     "$dir" "-"     php artisan queue:work --tries=3 ;;
    app)       start_process app       "$dir" "$port" npx next dev -p "$port" ;;
  esac
}

do_start() {
  local service="$1"
  # Pre-flight: make sure every target port is free (or held only by our own service)
  # before launching anything — abort loudly instead of double-binding a busy port.
  local targets; [ "$service" = "all" ] && targets="$SERVICES" || targets="$service"
  local conflict=0
  for s in $targets; do
    require_port_free "$s" "$(get_service_port "$s")" || conflict=1
  done
  [ "$conflict" -ne 0 ] && log_fail "port conflict — aborting start. Resolve the above, then retry."

  if [ "$service" = "all" ]; then
    print_header "Classly - Starting All Services"
    for s in $SERVICES; do print_section "Starting $s"; start_one "$s"; done
    echo ""
    print_line "="
    printf "  ${BOLD}Services Started${RESET}\n"
    print_line "-"
    print_kv "api"       "http://localhost:$API_PORT       (health: /up)"
    print_kv "app"       "http://localhost:$APP_PORT"
    print_line "="
  else
    print_section "Starting $service"; start_one "$service"
  fi
}

# ──────────────────────────────────────────────────
# Stop / Restart
# ──────────────────────────────────────────────────
stop_one() {
  local service="$1"
  local port; port=$(get_service_port "$service")
  if [ "$port" != "-" ]; then
    kill_port "$port" && log_info "$service stopped" || log_warn "$service: port $port still busy"
  fi
  local pid; pid=$(get_pid "$service" || true)
  [ -n "$pid" ] && kill_process "$pid" || true
  rm_pid "$service"
}

do_stop() {
  local service="$1"
  if [ "$service" = "all" ]; then
    print_section "Stopping all services"
    for s in $SERVICES; do stop_one "$s"; done
    # NOTE: deliberately no blanket `pkill -f "artisan queue:work"` — on a shared dev box it
    # would kill OTHER projects' queue workers too. Our own worker is PID-tracked (scripts/.pids).
  else
    print_section "Stopping $service"; stop_one "$service"
  fi
}

do_restart() {
  local service="$1"
  do_stop "$service"; sleep 1; do_start "$service"
}

# ──────────────────────────────────────────────────
# Status
# ──────────────────────────────────────────────────
status_one() {
  local service="$1"
  local port; port=$(get_service_port "$service")
  local status; status=$(get_process_status "$service" "$port")
  local label="stopped" color="$RED"
  [[ "$status" == running* ]] && { label="running"; color="$GREEN"; }
  printf "  ${BOLD}%-11s${RESET} ${color}%-9s${RESET} %s\n" "$service" "$label" \
    "$([ "$port" != "-" ] && echo ":$port" || echo "(worker)")"
}

do_status() {
  local service="$1"
  print_header "Classly - Status"
  if [ "$service" = "all" ]; then
    for s in $SERVICES; do status_one "$s"; done
  else
    status_one "$service"
  fi
  echo ""
}

# ──────────────────────────────────────────────────
# Logs
# ──────────────────────────────────────────────────
do_logs() {
  local service="$1" lines="${2:-50}"
  if [ "$service" = "all" ]; then
    for s in $SERVICES; do show_logs "$s" "$lines"; done
  else
    show_logs "$service" "$lines"
  fi
}

# ──────────────────────────────────────────────────
# Build (production assets)
# ──────────────────────────────────────────────────
do_build() {
  local service="$1"
  case "$service" in
    app)       print_section "Building app (Next.js)";  ( cd "$ROOT/apps/app" && npm run build ) ;;
    all)       do_build app ;;
    *)         log_fail "build: unknown target '$service' (app | all)" ;;
  esac
}

# ──────────────────────────────────────────────────
# Verify (end-to-end health)
# ──────────────────────────────────────────────────
check() { # label url expected
  local code; code=$(curl -s -o /dev/null -w "%{http_code}" "$2" 2>/dev/null); code="${code:-000}"
  if [ "$code" = "$3" ] || { [ "$3" = "2xx" ] && [[ "$code" =~ ^(200|301|302|307)$ ]]; }; then
    printf "  ${GREEN}[OK]${RESET}   %-34s %s\n" "$1" "$code"
  else
    printf "  ${RED}[FAIL]${RESET} %-34s %s (want %s)\n" "$1" "$code" "$3"
  fi
}

do_verify() {
  print_header "Classly - Verify"
  check "api  /up"                      "http://localhost:$API_PORT/up" "200"
  check "app  root"                     "http://localhost:$APP_PORT/" "2xx"
  echo ""
  log "Tip: fake API 404s = stale ServBay opcache → 'php artisan optimize:clear' + restart api"
}

# ──────────────────────────────────────────────────
# Dispatch
# ──────────────────────────────────────────────────
case "$CMD" in
  setup)   do_setup ;;
  start)   do_start "$SERVICE" ;;
  stop)    do_stop "$SERVICE" ;;
  restart) do_restart "$SERVICE" ;;
  status)  do_status "$SERVICE" ;;
  logs)    do_logs "$SERVICE" "$ARG" ;;
  build)   do_build "$SERVICE" ;;
  verify)  do_verify ;;
  *)
    print_header "Classly - Dev Manager"
    printf "${BOLD}Usage:${RESET} bash scripts/dev.sh <command> [service] [arg]\n"
    print_subsection "Commands"
    printf "  ${CYAN}%-11s${RESET} %s\n" "setup"   "Install deps + .env + migrate & seed (SQLite)"
    printf "  ${CYAN}%-11s${RESET} %s\n" "start"   "Start (all | api | queue | app)"
    printf "  ${CYAN}%-11s${RESET} %s\n" "stop"    "Stop  (all | api | queue | app)"
    printf "  ${CYAN}%-11s${RESET} %s\n" "restart" "Restart (all | <service>)"
    printf "  ${CYAN}%-11s${RESET} %s\n" "status"  "Show service status"
    printf "  ${CYAN}%-11s${RESET} %s\n" "logs"    "Show logs (all | <service>) [lines]"
    printf "  ${CYAN}%-11s${RESET} %s\n" "build"   "Build prod assets (app | all)"
    printf "  ${CYAN}%-11s${RESET} %s\n" "verify"  "End-to-end health checks"
    print_subsection "Services"
    printf "  ${CYAN}api${RESET}        Laravel API                 :$API_PORT\n"
    printf "  ${CYAN}queue${RESET}      Laravel queue worker           (no port)\n"
    printf "  ${CYAN}app${RESET}        Next.js app (BFF)              :$APP_PORT\n"
    print_subsection "Examples"
    printf "  ${DIM}bash scripts/dev.sh setup            # first-time bootstrap${RESET}\n"
    printf "  ${DIM}bash scripts/dev.sh start            # start everything${RESET}\n"
    printf "  ${DIM}bash scripts/dev.sh start api        # start API only${RESET}\n"
    printf "  ${DIM}bash scripts/dev.sh logs app 100     # last 100 app log lines${RESET}\n"
    printf "  ${DIM}bash scripts/dev.sh restart api      # restart API (clears opcache flakiness)${RESET}\n"
    printf "  ${DIM}bash scripts/dev.sh verify           # health-check the running stack${RESET}\n"
    print_subsection "Notes"
    printf "  ${DIM}start pre-flights each port ($API_PORT/$APP_PORT) and aborts on a conflict.${RESET}\n"
    printf "  ${DIM}Docker/VPS deploy: run scripts/check-ports.sh (80/443/3306) before docker compose up.${RESET}\n"
    echo ""
    exit 1
    ;;
esac
