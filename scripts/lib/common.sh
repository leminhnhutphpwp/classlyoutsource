#!/usr/bin/env bash
# scripts/lib/common.sh — Shared utilities (logging, formatting)

CONSOLE_WIDTH=${CONSOLE_WIDTH:-80}

# Color codes
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[0;33m'
BLUE=$'\033[0;34m'
MAGENTA=$'\033[0;35m'
CYAN=$'\033[0;36m'
BOLD=$'\033[1m'
DIM=$'\033[2m'
RESET=$'\033[0m'

# Logging functions
log_info() {
  local msg="$1"
  echo -e "  ${GREEN}${BOLD}info:${RESET} $msg"
}

log_warn() {
  local msg="$1"
  echo -e "  ${YELLOW}warn:${RESET} $msg"
}

log_fail() {
  local msg="$1"
  echo -e "  ${RED}fail:${RESET} $msg" >&2
  exit 1
}

log() {
  echo "  $1"
}

log_time() {
  echo "  [$(date '+%H:%M:%S')] $1"
}

# Key-value display
print_kv() {
  printf "  ${BOLD}%-15s${RESET} %s\n" "$1" "$2"
}

# Section helpers
print_subsection() {
  echo ""
  echo "  --- $1 ---"
  echo ""
}

print_line() {
  local char="${1:--}"
  local width="${2:-$CONSOLE_WIDTH}"
  printf '%*s\n' "$width" | tr ' ' "$char"
}

print_header() {
  local title="$1"
  local width="${2:-$CONSOLE_WIDTH}"
  local padding=$(( (width - ${#title} - 2) / 2 ))
  echo ""
  print_line "=" "$width"
  printf "%${padding}s %s %${padding}s\n" "" "$title" ""
  print_line "=" "$width"
  echo ""
}

print_section() {
  echo ""
  echo "  $1"
  echo ""
}

print_step()    { echo "  > $1"; }
print_success() { echo "  [OK] $1"; }
print_error()   { echo "  [ERROR] $1" >&2; }
print_warning() { echo "  [WARNING] $1"; }

prompt() {
  local msg="$1"
  echo -n "  $msg (y/N): "
  read -r response
  if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo "  Cancelled."
    exit 1
  fi
}

confirm_destructive() {
  echo ""
  echo "  WARNING: This will $1"
  echo "  This action cannot be undone."
  prompt "Are you sure you want to continue?"
}

# Tool checks
require_cmd() {
  command -v "$1" >/dev/null 2>&1 || log_fail "$1 is not installed"
}
