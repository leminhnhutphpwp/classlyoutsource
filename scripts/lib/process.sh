#!/usr/bin/env bash
# scripts/lib/process.sh — Process management (PID files, port detection)
# Host processes for local dev: api (php artisan serve), queue (php artisan queue:work),
# app (next dev). Queue has no port — tracked by PID only.

PID_FILE="$ROOT/scripts/.pids"

save_pid() {
  local name="$1" pid="$2"
  local tmp; tmp=$(mktemp)
  [ -f "$PID_FILE" ] && grep -v "^${name}:" "$PID_FILE" > "$tmp" 2>/dev/null || true
  echo "$name:$pid" >> "$tmp"
  mv "$tmp" "$PID_FILE"
}

rm_pid() {
  local name="$1"
  [ ! -f "$PID_FILE" ] && return
  local tmp; tmp=$(mktemp)
  grep -v "^${name}:" "$PID_FILE" > "$tmp" 2>/dev/null || true
  mv "$tmp" "$PID_FILE"
  [ -s "$PID_FILE" ] || rm -f "$PID_FILE"
}

get_pid() {
  local name="$1"
  [ ! -f "$PID_FILE" ] && return 1
  grep "^${name}:" "$PID_FILE" | cut -d: -f2
}

# Find PIDs listening on a port — but only PIDs visible to THIS user (lsof, fuser and
# `ss -p` all hide other users' processes without root). A port can therefore be busy
# with an empty result here; callers that only need "is it listening" must use port_in_use.
pids_on_port() {
  local port="$1" pids=""
  # Every probe is `... || true` inside the substitution: lsof/fuser exit 1 on "no match",
  # and under `set -o pipefail` that must not abort this (always-return-0) helper.
  if command -v lsof >/dev/null 2>&1; then
    pids=$(lsof -ti "TCP:$port" -sTCP:LISTEN 2>/dev/null | tr '\n' ' ' || true)
    [ -n "$pids" ] && echo "$pids" && return 0
  fi
  if command -v fuser >/dev/null 2>&1; then
    pids=$(fuser "$port/tcp" 2>/dev/null | tr ' ' '\n' | tr '\n' ' ' || true)
    [ -n "$pids" ] && echo "$pids" && return 0
  fi
  # Last resort (Linux): `ss -p` also only reports our own processes, but it exists on
  # minimal images where lsof/fuser are missing.
  if command -v ss >/dev/null 2>&1; then
    pids=$(ss -H -ltnp "sport = :$port" 2>/dev/null | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -un | tr '\n' ' ' || true)
    [ -n "$pids" ] && echo "$pids" && return 0
  fi
  # Always return 0 (echo empty when none) so callers under `set -o pipefail`
  # don't abort on a free port. Callers test the emptiness of the output.
  return 0
}

# True (0) if ANYTHING is listening on the TCP port, else 1.
# Order: PIDs we can see (lsof/fuser/ss -p) → a bare LISTEN line via `ss -ltn`
# (this one DOES see other users' sockets) → nc → a bash /dev/tcp probe.
# Fully guarded so a closed port never aborts the script under `set -e`.
port_in_use() {
  local port="$1"
  [ "$port" = "-" ] && return 1
  local pids; pids=$(pids_on_port "$port")
  [ -n "${pids// /}" ] && return 0
  if command -v ss >/dev/null 2>&1; then
    [ -n "$(ss -H -ltn "sport = :$port" 2>/dev/null || true)" ] && return 0
  fi
  if command -v nc >/dev/null 2>&1; then
    nc -z -w1 localhost "$port" >/dev/null 2>&1 && return 0
    return 1
  fi
  ( exec 3<>"/dev/tcp/127.0.0.1/$port" ) >/dev/null 2>&1 && return 0
  return 1
}

# Does this PID actually belong to our dev stack? PID files go stale (reboot, copied repo,
# sandboxed/PID-namespaced shells) and can point at an unrelated live process — a bare
# `kill -0` check would then trust a total stranger. Verify the command line instead.
pid_is_service() {
  local name="$1" pid="$2" args=""
  args=$(ps -p "$pid" -o args= 2>/dev/null | head -1 || true)
  [ -n "$args" ] || return 1
  case "$name" in
    api|queue) [[ "$args" == *artisan* ]] ;;
    app)       [[ "$args" == *next* || "$args" == *node* ]] ;;
    *)         return 1 ;;
  esac
}

# Pre-flight guard: fail (1) if a *foreign* process holds the service's port.
# Our own already-running service (its tracked PID is alive AND looks like the service)
# is allowed through so `start` stays idempotent — start_one() then short-circuits.
require_port_free() {
  local service="$1" port="$2"
  [ "$port" = "-" ] && return 0
  # If we already track a live process for this service, it owns the port — allow.
  local own; own=$(get_pid "$service" || true)
  if [ -n "$own" ] && pid_is_service "$service" "$own"; then
    return 0
  fi
  # A tracked-but-foreign PID is a stale entry (reboot / copied repo) — drop it.
  [ -n "$own" ] && rm_pid "$service"
  port_in_use "$port" || return 0
  # Port is busy and it isn't our service → conflict. Name the holder if we can.
  # NOTE: lsof/fuser/ss -p only reveal the current user's processes — a root-owned
  # listener (system nginx, Docker proxy, another project's server) shows up as
  # "in use" with NO visible PID. Message both cases honestly.
  local holders first comm=""
  holders=$(pids_on_port "$port")
  first=$(echo "$holders" | awk '{print $1}')
  [ -n "$first" ] && comm=$(ps -p "$first" -o comm= 2>/dev/null | sed 's/^[[:space:]]*//')
  if [ -n "$comm" ]; then
    log_warn "$service: port $port already in use by PID $first ($comm) — refusing to double-bind."
    log "${DIM}free it with: kill \$(lsof -ti :$port)   # or stop the other app, then retry${RESET}"
  else
    log_warn "$service: port $port already in use — refusing to double-bind."
    log "${DIM}the holder runs as another user/root, so it isn't visible to this shell${RESET}"
    log "${DIM}(system nginx, Docker proxy, another project's server...). Identify it:${RESET}"
    log "${DIM}sudo ss -ltnp 'sport = :$port'   # stop it, or better: move this project's port${RESET}"
  fi
  log "${DIM}to move this project instead: set CLASSLY_API_PORT / CLASSLY_APP_PORT (env or scripts/.env.local)${RESET}"
  return 1
}

wait_port_free() {
  local port="$1" timeout="${2:-5}"
  for _ in $(seq 1 "$timeout"); do
    pids_on_port "$port" | grep -q . || return 0
    sleep 1
  done
  return 1
}

wait_pid_dead() {
  local pid="$1" timeout="${2:-3}"
  for _ in $(seq 1 "$timeout"); do
    kill -0 "$pid" 2>/dev/null || return 0
    sleep 1
  done
  return 1
}

kill_tree() {
  local pid="$1" signal="${2:-TERM}"
  for child in $(pgrep -P "$pid" 2>/dev/null || true); do
    kill_tree "$child" "$signal"
  done
  kill -"$signal" "$pid" 2>/dev/null || true
}

kill_process() {
  local pid="$1"
  [ -z "$pid" ] && return 1
  kill_tree "$pid" "TERM"
  if ! wait_pid_dead "$pid" 5; then
    kill_tree "$pid" "KILL"
    wait_pid_dead "$pid" 3 || true
  fi
  return 0
}

# Kill dev-server processes on a port (php/node/vite/next only — never other apps)
kill_port() {
  local port="$1"
  local port_pids; port_pids=$(pids_on_port "$port" || true)
  [ -z "$port_pids" ] && return 0
  for pid in $port_pids; do
    local comm; comm=$(ps -p "$pid" -o comm= 2>/dev/null || echo "")
    case "$comm" in
      *php*|*node*|*next*|*vite*|*npm*)
        kill_process "$pid" || true
        local ppid; ppid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
        if [ -n "$ppid" ] && [ "$ppid" -gt 1 ]; then
          local pcomm; pcomm=$(ps -p "$ppid" -o comm= 2>/dev/null || echo "")
          [[ "$pcomm" == *php* || "$pcomm" == *node* ]] && kill_process "$ppid" || true
        fi
        ;;
    esac
  done
  wait_port_free "$port" 10 && return 0
  return 1
}

# Start a host process in the background with logging.
# Usage: start_process <name> <dir> <port|-> <cmd...>   (port "-" = no port, PID-tracked)
start_process() {
  local name="$1" dir="$2" port="$3"; shift 3
  local log_dir="$ROOT/scripts/logs/$name" log_file
  log_file="$log_dir/output.log"
  mkdir -p "$log_dir"

  if [ "$port" != "-" ]; then
    local existing; existing=$(pids_on_port "$port" | head -1)
    if [ -n "$existing" ]; then
      log_warn "Port $port in use — stopping first"
      kill_port "$port"; sleep 1
    fi
  fi

  rm_pid "$name"
  ( cd "$dir" && exec nohup "$@" > "$log_file" 2>&1 ) &
  local pid=$!
  save_pid "$name" "$pid"

  sleep 3
  if kill -0 "$pid" 2>/dev/null; then
    if [ "$port" != "-" ]; then
      log_info "$name running (PID $pid) on port $port"
    else
      log_info "$name running (PID $pid)"
    fi
    return 0
  fi
  log_warn "Failed to start $name — last log lines:"
  tail -5 "$log_file" | while read -r line; do log "  $line"; done
  rm_pid "$name"   # don't leave a dead PID behind — a recycled one would look "alive"
  return 1
}

get_process_status() {
  local name="$1" port="$2"
  if [ "$port" != "-" ] && [ -n "$port" ]; then
    local port_pids; port_pids=$(pids_on_port "$port" 2>/dev/null || true)
    [ -n "$port_pids" ] && { echo "running:port-$port"; return 0; }
  fi
  local pid; pid=$(get_pid "$name" || true)
  if [ -n "$pid" ] && pid_is_service "$name" "$pid"; then
    echo "running:$pid"; return 0
  fi
  # Always return 0 — callers read the "running/stopped" string, not the exit code.
  # (Returning non-zero here would abort callers running under `set -e`.)
  echo "stopped"; return 0
}

show_logs() {
  local name="$1" lines="${2:-50}"
  local log_file="$ROOT/scripts/logs/$name/output.log"
  if [ -f "$log_file" ]; then
    print_subsection "$name logs (last $lines lines)"
    tail -n "$lines" "$log_file"
  else
    log "No log file for $name"
  fi
}
