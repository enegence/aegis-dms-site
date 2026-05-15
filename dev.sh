#!/usr/bin/env bash
set -euo pipefail

SITE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="aegis-dms-site"

DEFAULT_WEB_PORT="${WEB_PORT:-3001}"
DEFAULT_API_PORT="${AEGIS_PORT:-8001}"
DEFAULT_POSTGRES_PORT="${POSTGRES_PORT:-5432}"
DATABASE_URL_PROVIDED="${DATABASE_URL+x}"
DATABASE_URL="${DATABASE_URL:-postgresql://aegis:aegis@localhost:${DEFAULT_POSTGRES_PORT}/aegis_site}"
PORT_SCAN_LIMIT="${PORT_SCAN_LIMIT:-50}"

STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/${APP_NAME}"
PID_FILE="${STATE_DIR}/pids"
DB_PORT_FILE="${STATE_DIR}/postgres-port"
WEB_LOG="${STATE_DIR}/web.log"
API_LOG="${STATE_DIR}/api.log"

mkdir -p "$STATE_DIR"

if [[ -z "$DATABASE_URL_PROVIDED" && -f "$DB_PORT_FILE" ]]; then
  saved_postgres_port="$(cat "$DB_PORT_FILE")"
  if [[ "$saved_postgres_port" =~ ^[0-9]+$ ]]; then
    DEFAULT_POSTGRES_PORT="$saved_postgres_port"
    DATABASE_URL="postgresql://aegis:aegis@localhost:${DEFAULT_POSTGRES_PORT}/aegis_site"
  fi
fi

has_command() {
  command -v "$1" >/dev/null 2>&1
}

port_pids() {
  local port="$1"

  if has_command lsof; then
    lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true
    return
  fi

  if has_command fuser; then
    fuser "${port}/tcp" 2>/dev/null || true
    return
  fi
}

port_is_free() {
  local port="$1"
  local windows_listeners

  if has_command netstat.exe; then
    windows_listeners="$(netstat.exe -ano 2>/dev/null | tr -d '\r' || true)"
    if grep -Eq "[:.]${port}[[:space:]].*LISTENING" <<< "$windows_listeners"; then
      return 1
    fi
  fi

  [[ -z "$(port_pids "$1" | tr -d '[:space:]')" ]]
}

pid_cwd_is_site() {
  local pid="$1"
  local cwd

  cwd="$(readlink -f "/proc/${pid}/cwd" 2>/dev/null || true)"
  [[ -n "$cwd" && ( "$cwd" == "$SITE_DIR" || "$cwd" == "$SITE_DIR"/* ) ]]
}

wait_for_exit() {
  local pid="$1"
  local i

  for i in {1..40}; do
    if ! kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
    sleep 0.1
  done

  kill -KILL "$pid" 2>/dev/null || true
}

stop_pid() {
  local pid="$1"

  [[ -n "$pid" ]] || return 0
  kill -0 "$pid" 2>/dev/null || return 0
  kill "$pid" 2>/dev/null || true
  wait_for_exit "$pid"
}

stop_process_group() {
  local pid="$1"
  local pgid

  [[ -n "$pid" ]] || return 0
  kill -0 "$pid" 2>/dev/null || return 0

  pgid="$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d '[:space:]' || true)"
  if [[ -n "$pgid" ]]; then
    kill -TERM "-$pgid" 2>/dev/null || true
    wait_for_exit "$pid"
  else
    stop_pid "$pid"
  fi
}

stop_previous_launch() {
  if [[ ! -f "$PID_FILE" ]]; then
    return 0
  fi

  while read -r pid; do
    if pid_cwd_is_site "$pid"; then
      stop_process_group "$pid"
    fi
  done < "$PID_FILE"

  rm -f "$PID_FILE"
}

stop_site_listeners_in_range() {
  local start_port="$1"
  local end_port="$2"
  local port pid

  for (( port=start_port; port<=end_port; port++ )); do
    while read -r pid; do
      [[ -n "$pid" ]] || continue
      if pid_cwd_is_site "$pid"; then
        echo "Restarting existing ${APP_NAME} listener on :${port} (PID ${pid})"
        stop_pid "$pid"
      fi
    done < <(port_pids "$port")
  done
}

find_free_port() {
  local preferred="$1"
  local max_port=$(( preferred + PORT_SCAN_LIMIT ))
  local port

  for (( port=preferred; port<=max_port; port++ )); do
    if port_is_free "$port"; then
      echo "$port"
      return 0
    fi
    echo "Port ${port} is in use; trying next port..." >&2
  done

  echo "ERROR: no free port found between ${preferred} and ${max_port}" >&2
  return 1
}

ensure_dependencies() {
  if [[ -d "$SITE_DIR/node_modules" ]]; then
    return 0
  fi

  echo "Installing npm dependencies..."
  if [[ -f "$SITE_DIR/package-lock.json" ]]; then
    (cd "$SITE_DIR" && npm ci)
  else
    (cd "$SITE_DIR" && npm install)
  fi
}

docker_command() {
  if has_command docker && docker version >/dev/null 2>&1; then
    echo "docker"
    return 0
  fi

  if has_command docker.exe && docker.exe version >/dev/null 2>&1; then
    echo "docker.exe"
    return 0
  fi

  return 1
}

compose_postgres_port() {
  local docker_bin="$1"
  local mapped

  mapped="$(
    cd "$SITE_DIR"
    "$docker_bin" compose port postgres 5432 2>/dev/null | head -1 || true
  )"

  [[ -n "$mapped" ]] || return 1
  echo "${mapped##*:}"
}

database_is_ready() {
  (
    cd "$SITE_DIR"
    DATABASE_URL="$DATABASE_URL" node --input-type=module -e '
      import postgres from "postgres";
      const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 2 });
      await sql`select 1`;
      await sql.end();
    '
  ) >/dev/null 2>&1
}

wait_for_database() {
  local i

  for i in {1..80}; do
    if database_is_ready; then
      return 0
    fi
    sleep 0.25
  done

  echo "ERROR: PostgreSQL did not become ready at ${DATABASE_URL}" >&2
  exit 1
}

ensure_database() {
  local docker_bin
  local postgres_port

  docker_bin="$(docker_command || true)"

  if [[ -z "$DATABASE_URL_PROVIDED" && -n "$docker_bin" ]]; then
    postgres_port="$(compose_postgres_port "$docker_bin" || true)"
    if [[ "$postgres_port" =~ ^[0-9]+$ ]]; then
      export POSTGRES_PORT="$postgres_port"
      export DATABASE_URL="postgresql://aegis:aegis@localhost:${postgres_port}/aegis_site"
      echo "$postgres_port" > "$DB_PORT_FILE"
    fi
  fi

  if database_is_ready; then
    echo "PostgreSQL is already reachable."
  else
    if [[ -z "$DATABASE_URL_PROVIDED" ]]; then
      postgres_port="$(find_free_port "$DEFAULT_POSTGRES_PORT")"
      export POSTGRES_PORT="$postgres_port"
      export DATABASE_URL="postgresql://aegis:aegis@localhost:${postgres_port}/aegis_site"
      echo "$postgres_port" > "$DB_PORT_FILE"
    fi

    if [[ -z "$docker_bin" ]]; then
      echo "ERROR: PostgreSQL is not reachable and Docker is not installed in this environment." >&2
      echo "Install/start PostgreSQL with DATABASE_URL=${DATABASE_URL}, or enable Docker Desktop WSL integration." >&2
      exit 1
    fi

    echo "Starting PostgreSQL with Docker Compose..."
    (cd "$SITE_DIR" && "$docker_bin" compose up -d --force-recreate postgres)
    wait_for_database
  fi

  echo "Applying database migrations..."
  (cd "$SITE_DIR" && DATABASE_URL="$DATABASE_URL" npm run db:migrate --workspace=server)
}

start_service() {
  local log_file="$1"
  shift

  if ! has_command setsid; then
    echo "ERROR: setsid is required to detach and restart local dev services safely." >&2
    exit 1
  fi

  : > "$log_file"
  (
    cd "$SITE_DIR"
    exec setsid "$@"
  ) >"$log_file" 2>&1 &
  echo "$!"
}

wait_for_url() {
  local label="$1"
  local url="$2"
  local pid="$3"
  local log_file="$4"
  local i

  for i in {1..80}; do
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "ERROR: ${label} exited before it was ready. Log:" >&2
      tail -80 "$log_file" >&2 || true
      exit 1
    fi

    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi

    sleep 0.25
  done

  echo "ERROR: ${label} did not become ready at ${url}. Log:" >&2
  tail -80 "$log_file" >&2 || true
  exit 1
}

echo "Starting ${APP_NAME} locally..."

stop_previous_launch
stop_site_listeners_in_range "$DEFAULT_WEB_PORT" "$(( DEFAULT_WEB_PORT + PORT_SCAN_LIMIT ))"
stop_site_listeners_in_range "$DEFAULT_API_PORT" "$(( DEFAULT_API_PORT + PORT_SCAN_LIMIT ))"

WEB_PORT="$(find_free_port "$DEFAULT_WEB_PORT")"
API_PORT="$(find_free_port "$DEFAULT_API_PORT")"

ensure_dependencies
ensure_database

echo "API port: ${API_PORT}"
echo "Web port: ${WEB_PORT}"
echo "Database: ${DATABASE_URL}"

API_PID="$(start_service "$API_LOG" env \
  DATABASE_URL="$DATABASE_URL" \
  AEGIS_HOST=127.0.0.1 \
  AEGIS_PORT="$API_PORT" \
  AEGIS_BASE_URL="http://127.0.0.1:${API_PORT}" \
  npm run dev --workspace=server)"

wait_for_url "API" "http://127.0.0.1:${API_PORT}/health" "$API_PID" "$API_LOG"

WEB_PID="$(start_service "$WEB_LOG" env \
  VITE_API_TARGET="http://127.0.0.1:${API_PORT}" \
  npm run dev --workspace=web -- --host 127.0.0.1 --port "$WEB_PORT" --strictPort)"

wait_for_url "web app" "http://127.0.0.1:${WEB_PORT}/" "$WEB_PID" "$WEB_LOG"

printf "%s\n%s\n" "$API_PID" "$WEB_PID" > "$PID_FILE"

echo
echo "Aegis DMS is running:"
echo "  http://127.0.0.1:${WEB_PORT}"
echo
echo "Logs:"
echo "  API: ${API_LOG}"
echo "  Web: ${WEB_LOG}"
