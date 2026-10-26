#!/usr/bin/env bash
# scripts/deploy.sh — Production deployment (Docker)
#
# Usage:
#   bash scripts/deploy.sh                  # deploy the prod stack (docker-compose.prod.yml)
#   bash scripts/deploy.sh v1.2.3           # explicit image tag
#   bash scripts/deploy.sh --traefik v1.2.3 # clean-server Traefik variant (docker-compose.yml +
#                                           # docker-compose.shared.yml) — see docs/DEPLOY.md
#
# The prod stack is the default production target (host nginx fronts 127.0.0.1:8101/8102;
# MySQL/Redis are this project's own containers on classly-net). It needs NO shared stack and
# NEVER touches :80/:443 — safe to run on a server whose nginx already serves other sites.
#
# ⚠️ NEVER run `--traefik` on a host whose nginx already serves sites: it starts Traefik bound to
# :80/:443 and takes those sites down. Follow docs/DEPLOY-PROD.md for such a host.
# -------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/scripts/lib/common.sh"
source "$ROOT/scripts/lib/docker.sh"

# ──────────────────────────────────────────────────
# Arg parsing: [--traefik] [version]
# ──────────────────────────────────────────────────
STACK="prod"
ARGS=()
for a in "$@"; do
  if [ "$a" = "--traefik" ]; then STACK="traefik"; else ARGS+=("$a"); fi
done
DATE_TAG="$(date +%Y%m%d-%H%M%S)"
VERSION="${ARGS[0]:-v$DATE_TAG}"
export IMAGE_TAG="$VERSION"

# ──────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────
validate_env() {
  local missing=()
  for var in "$@"; do
    [ -z "${!var:-}" ] && missing+=("$var")
  done
  [ ${#missing[@]} -gt 0 ] && log_fail "Missing required environment variables: ${missing[*]}"
}

# ──────────────────────────────────────────────────
# 0. Validate
# ──────────────────────────────────────────────────
print_header "Classly - Deploy $VERSION ($STACK stack)"

print_section "0. Validate environment"
[ -f "$ROOT/.env" ] || log_fail "Missing root .env — copy .env.example and fill secrets"
set -a; source "$ROOT/.env"; set +a
require_docker

if [ "$STACK" = "traefik" ]; then
  echo ""
  log_warn "Traefik clean-server variant selected — see docs/DEPLOY.md."
  log_warn "If this host's nginx already holds :80/:443, STOP: use the default"
  log_warn "prod stack instead. Starting the shared stack there takes the other sites down."
  echo ""
  prompt "Continue with the Traefik stack on THIS host?"
  # Traefik routing hosts + Let's Encrypt exist only in this variant
  REQUIRED_VARS=(APP_KEY JWT_SECRET DB_PASSWORD REDIS_PASSWORD MYSQL_ROOT_PASSWORD HASHIDS_SALT API_HOST APP_HOST)
else
  # Variables interpolated by docker-compose.prod.yml itself (+ secrets consumed via env_file)
  REQUIRED_VARS=(APP_KEY JWT_SECRET DB_DATABASE DB_USERNAME DB_PASSWORD REDIS_PASSWORD MYSQL_ROOT_PASSWORD)
fi
validate_env "${REQUIRED_VARS[@]}"
compose_validate
log_info "Environment validated"

# ──────────────────────────────────────────────────
# 1. Shared services — Traefik variant ONLY
# ──────────────────────────────────────────────────
if [ "$STACK" = "traefik" ]; then
  print_section "1. Shared services (proxy + mysql + redis)"
  if require_shared_network; then
    log_info "Shared network present — assuming shared stack is up"
  else
    print_step "Bringing up shared stack (once per server)"
    compose_shared up -d
    log_info "Shared services started"
  fi
else
  print_section "1. Shared services"
  log_info "Skipped — the prod stack is self-contained (its own mysql/redis on classly-net)"
fi

# ──────────────────────────────────────────────────
# 2. Build project images
# ──────────────────────────────────────────────────
print_section "2. Build images ($VERSION)"
if [ "$STACK" = "traefik" ]; then compose build; else compose_prod build; fi
log_info "Images built: classly-api/app:$VERSION"

# ──────────────────────────────────────────────────
# 3. Deploy
# ──────────────────────────────────────────────────
print_section "3. Deploy project services"
if [ "$STACK" = "traefik" ]; then compose up -d; else compose_prod up -d; fi
log_info "Project services up (api + queue + app)"

# ──────────────────────────────────────────────────
# 4. Health
# ──────────────────────────────────────────────────
print_section "4. Health check"
sleep 5
if [ "$STACK" = "traefik" ]; then
  compose_status
  echo ""
  # Traefik fronts :80 — route by Host header
  code=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: ${API_HOST}" "http://localhost/up" 2>/dev/null || echo "000")
  hint="docker compose logs -f api   # service name — `classly-api` is only the container name"
else
  compose_prod ps --format "table {{.Name}}\t{{.State}}\t{{.Ports}}" 2>/dev/null
  echo ""
  # The prod stack publishes the API on loopback 8101 (nginx fronts it for the outside world)
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:8101/up" 2>/dev/null || echo "000")
  hint="docker compose -f docker-compose.prod.yml logs -f api"
fi
if [ "$code" = "200" ]; then
  log_info "API healthy ($code)"
else
  log_warn "API health returned $code — check: $hint"
fi

echo ""; print_line "="
log_info "Deploy $VERSION ($STACK) complete"
log "Logs:   $hint"
print_line "="
