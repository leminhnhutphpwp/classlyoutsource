#!/usr/bin/env bash
# scripts/migrate.sh — Database migrations
# Usage:
#   bash scripts/migrate.sh              # local (host, SQLite) — migrate
#   bash scripts/migrate.sh seed         # local — migrate + seed
#   bash scripts/migrate.sh fresh        # local — migrate:fresh --seed (DESTRUCTIVE)
#   bash scripts/migrate.sh docker       # migrate in the PRODUCTION container (docker-compose.prod.yml,
#                                        # service `api` — the compose file production actually runs)
# -------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/scripts/lib/common.sh"

MODE="${1:-migrate}"

run_local() {
  cd "$ROOT/apps/api"
  local driver; driver=$(grep -E '^DB_CONNECTION=' .env 2>/dev/null | cut -d= -f2 || echo "sqlite")
  print_kv "connection" "${driver:-sqlite}"
  case "$MODE" in
    migrate) print_section "Local migrate";        php artisan migrate --force ;;
    seed)    print_section "Local migrate + seed";  php artisan migrate --seed --force ;;
    fresh)
      [ "$driver" = "sqlite" ] || confirm_destructive "DROP ALL TABLES on '$driver'"
      print_section "Local migrate:fresh --seed"
      php artisan migrate:fresh --seed --force
      ;;
    *) log_fail "Unknown mode '$MODE' (migrate | seed | fresh | docker)" ;;
  esac
  php artisan optimize:clear
  log_info "Done. Restart 'php artisan serve' if it is running (opcache)."
}

run_docker() {
  print_section "Migrate in the production container (docker-compose.prod.yml)"
  # `docker compose exec` takes the SERVICE name (`api`), not the container name (`classly-api`)
  # — `exec classly-api` fails with "no such service". The prod compose file is the default production target;
  # the Traefik variant (docker-compose.yml, same service names) still works as-is.
  docker compose -f "$ROOT/docker-compose.prod.yml" exec api php artisan migrate --force
  log_info "Container migration done"
}

print_header "Classly - Migrate"
case "$MODE" in
  docker) run_docker ;;
  *)      run_local ;;
esac
