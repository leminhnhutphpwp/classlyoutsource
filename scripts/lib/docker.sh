#!/usr/bin/env bash
# scripts/lib/docker.sh — Docker Compose helpers
#
# THREE compose files exist — see docs/RUNNING-MODES.md:
#   docker-compose.prod.yml   ← default PRODUCTION stack (host nginx, no Traefik)
#   docker-compose.yml          ← clean-server Traefik variant (docker-compose.shared.yml + this)
#   docker-compose.dev.yml      ← opt-in LOCAL dev stack (never used for deploy)

PROJECT_COMPOSE="$ROOT/docker-compose.yml"      # Traefik clean-server variant (docker-compose.yml)
SHARED_COMPOSE="$ROOT/docker-compose.shared.yml"
PROD_COMPOSE="$ROOT/docker-compose.prod.yml" # default production stack

# Project compose wrapper (classly-* services)
compose() {
  docker compose -f "$PROJECT_COMPOSE" "$@"
}

# Production compose wrapper — the stack production actually runs (host nginx fronts it).
compose_prod() {
  docker compose -f "$PROD_COMPOSE" "$@"
}

# Shared compose wrapper (proxy/mysql/redis — Traefik clean-server variant ONLY)
compose_shared() {
  docker compose -f "$SHARED_COMPOSE" "$@"
}

require_docker() {
  command -v docker >/dev/null 2>&1 || log_fail "Docker is not installed"
  docker info >/dev/null 2>&1 || log_fail "Docker daemon is not running"
  docker compose version >/dev/null 2>&1 || log_fail "Docker Compose v2 is not available"
}

# Validate the compose files parse (cheap, no containers touched)
compose_validate() {
  compose config >/dev/null 2>&1 || log_fail "docker-compose.yml is invalid"
  # shared.yml needs LETSENCRYPT_EMAIL (Traefik ACME) + DB creds; prod.yml requires
  # DB_PASSWORD/MYSQL_ROOT_PASSWORD/REDIS_PASSWORD (declared with `:?`, no default).
  MYSQL_ROOT_PASSWORD=x REDIS_PASSWORD=y LETSENCRYPT_EMAIL=x@example.com compose_shared config >/dev/null 2>&1 \
    || log_fail "docker-compose.shared.yml is invalid"
  MYSQL_ROOT_PASSWORD=x DB_PASSWORD=x REDIS_PASSWORD=y compose_prod config >/dev/null 2>&1 \
    || log_fail "docker-compose.prod.yml is invalid"
  log_info "Compose files valid"
}

# Ensure the external `shared` network exists (created by the shared stack)
require_shared_network() {
  if ! docker network inspect shared >/dev/null 2>&1; then
    log_warn "Network 'shared' not found — bring up shared services first:"
    log "  docker compose -f docker-compose.shared.yml up -d"
    return 1
  fi
  return 0
}

compose_status() {
  compose ps --format "table {{.Service}}\t{{.State}}\t{{.Ports}}" 2>/dev/null
}
