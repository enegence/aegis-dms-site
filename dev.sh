#!/usr/bin/env bash
set -euo pipefail

SITE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PREFERRED_PORT=3000
MAX_PORT=3020
SERVER_LOG="/tmp/aegis-dms-server.log"
PID_FILE="/tmp/aegis-dms-server.pid"

# ── helpers ────────────────────────────────────────────────────────────────────

port_pid() {
  # lsof exits 1 when nothing found; suppress so pipefail doesn't bite us
  { lsof -ti tcp:"$1" 2>/dev/null || true; } | head -1
}

is_our_server() {
  local pid="$1"
  [[ -z "$pid" ]] && return 1
  local cwd
  cwd=$(readlink -f /proc/"$pid"/cwd 2>/dev/null) || return 1
  [[ "$cwd" == "$SITE_DIR" ]]
}

kill_our_server() {
  local pid="$1"
  kill "$pid" 2>/dev/null || true
  local i=0
  while kill -0 "$pid" 2>/dev/null && (( i < 20 )); do
    sleep 0.1
    i=$(( i + 1 ))   # avoid (( i++ )) exit-code 1 when i was 0
  done
}

start_server() {
  local port="$1"
  if command -v python3 &>/dev/null; then
    python3 -m http.server "$port" --bind 127.0.0.1 \
      --directory "$SITE_DIR" >"$SERVER_LOG" 2>&1 &
  elif command -v python &>/dev/null; then
    # Python 2 doesn't support --directory; cd first inside subshell
    ( cd "$SITE_DIR" && python -m SimpleHTTPServer "$port" ) >"$SERVER_LOG" 2>&1 &
  elif command -v npx &>/dev/null; then
    npx --yes serve -l "$port" "$SITE_DIR" >"$SERVER_LOG" 2>&1 &
  else
    echo "ERROR: no http server available (need python3, python, or npx)" >&2
    exit 1
  fi
  echo $!
}

wait_ready() {
  local port="$1" pid="$2"
  local i=0
  while (( i < 40 )); do
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "ERROR: server process died. Log:" >&2
      cat "$SERVER_LOG" >&2
      exit 1
    fi
    if curl -sf "http://127.0.0.1:${port}/" -o /dev/null 2>/dev/null; then
      return 0
    fi
    sleep 0.25
    i=$(( i + 1 ))
  done
  echo "ERROR: server not ready on :${port} after 10s" >&2
  cat "$SERVER_LOG" >&2
  exit 1
}

# ── main ───────────────────────────────────────────────────────────────────────

echo "Aegis DMS — dev start"
echo "Dir: $SITE_DIR"
echo

# stop any instance we previously launched
if [[ -f "$PID_FILE" ]]; then
  OLD_PID=$(cat "$PID_FILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "Stopping previous server (PID $OLD_PID)..."
    kill_our_server "$OLD_PID"
  fi
  rm -f "$PID_FILE"
fi

# find a usable port
CHOSEN_PORT=""
for (( p=PREFERRED_PORT; p<=MAX_PORT; p++ )); do
  PID=$(port_pid "$p")
  if [[ -z "$PID" ]]; then
    CHOSEN_PORT=$p
    break
  fi
  if is_our_server "$PID"; then
    echo "Found our server on :${p} (PID $PID) — restarting..."
    kill_our_server "$PID"
    CHOSEN_PORT=$p
    break
  fi
  echo "Port $p in use by PID $PID (not ours) — skipping"
done

if [[ -z "$CHOSEN_PORT" ]]; then
  echo "ERROR: no free port found between $PREFERRED_PORT and $MAX_PORT" >&2
  exit 1
fi

echo "Starting server on :${CHOSEN_PORT}..."
SERVER_PID=$(start_server "$CHOSEN_PORT")
echo "$SERVER_PID" > "$PID_FILE"

wait_ready "$CHOSEN_PORT" "$SERVER_PID"

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Aegis DMS — running"
echo
printf "  \033[1;34mhttp://127.0.0.1:%s\033[0m\n" "$CHOSEN_PORT"
echo
printf "  PID %-8s log: %s\n" "$SERVER_PID" "$SERVER_LOG"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
