#!/usr/bin/env sh
set -eu

SYM_HOME="${SYM_HOME:-/opt/symmetricds}"
ENGINE_NAME="${SYMMETRIC_ENGINE_NAME:-node-mac}"
ENGINE_FILE="${SYM_HOME}/engines/${ENGINE_NAME}.properties"
SERVER_FILE="${SYM_HOME}/conf/symmetric-server.properties"

discover_tailscale_ip() {
  if ! command -v ip >/dev/null 2>&1; then
    return 1
  fi

  ip -4 -o addr show dev tailscale0 2>/dev/null \
    | awk '{print $4}' \
    | cut -d/ -f1 \
    | head -n 1
}

set_prop() {
  file="$1"
  key="$2"
  value="$3"
  tmp_file="$(mktemp)"

  awk -F= -v key="$key" '$1 != key { print }' "$file" > "$tmp_file"
  printf '%s=%s\n' "$key" "$value" >> "$tmp_file"
  mv "$tmp_file" "$file"
}

if [ ! -f "$ENGINE_FILE" ]; then
  echo "SymmetricDS engine file not found: $ENGINE_FILE" >&2
  echo "Available engines:" >&2
  find "${SYM_HOME}/engines" -maxdepth 1 -name '*.properties' -print >&2
  exit 1
fi

mkdir -p "${SYM_HOME}/logs" "${SYM_HOME}/tmp"

http_port="${SYMMETRIC_HTTP_PORT:-31415}"
set_prop "$SERVER_FILE" "http.port" "$http_port"
set_prop "$SERVER_FILE" "host.bind.name" "0.0.0.0"
set_prop "$SERVER_FILE" "http.enable" "true"

symmetric_db_url="${SYMMETRIC_DB_URL:-}"
if [ -z "$symmetric_db_url" ] && [ -n "${DB_HOST:-}" ]; then
  db_port="${DB_PORT:-5432}"
  db_name="${DB_NAME:-postgres}"
  symmetric_db_url="jdbc:postgresql://${DB_HOST}:${db_port}/${db_name}"
fi

if [ -n "$symmetric_db_url" ]; then
  set_prop "$ENGINE_FILE" "db.url" "$symmetric_db_url"
fi

db_user="${SYMMETRIC_DB_USER:-${DB_USER:-}}"
if [ -n "$db_user" ]; then
  set_prop "$ENGINE_FILE" "db.user" "$db_user"
fi

db_password="${SYMMETRIC_DB_PASSWORD:-${DB_PASSWORD:-}}"
if [ -n "$db_password" ]; then
  set_prop "$ENGINE_FILE" "db.password" "$db_password"
fi

public_base_url="${SYMMETRIC_PUBLIC_URL:-}"
if [ -z "$public_base_url" ]; then
  public_host="${TAILSCALE_PUBLIC_HOST:-${TAILSCALE_MAC_IP:-}}"
  if [ -z "$public_host" ]; then
    public_host="$(discover_tailscale_ip || true)"
  fi
  if [ -n "$public_host" ]; then
    public_base_url="http://${public_host}:${http_port}"
  fi
fi

sync_url="${SYMMETRIC_SYNC_URL:-}"
if [ -z "$sync_url" ] && [ -n "$public_base_url" ]; then
  sync_url="${public_base_url%/}/sync/${ENGINE_NAME}"
fi

if [ -n "$sync_url" ]; then
  set_prop "$ENGINE_FILE" "sync.url" "$sync_url"
fi

registration_url="${SYMMETRIC_REGISTRATION_URL:-}"
if [ -z "$registration_url" ] && [ "$ENGINE_NAME" = "node-mac" ] && [ -n "${TAILSCALE_WINDOWS_IP:-}" ]; then
  registration_url="http://${TAILSCALE_WINDOWS_IP}:31415/sync/node-win"
fi
if [ -z "$registration_url" ] && [ "$ENGINE_NAME" = "node-win" ] && [ -n "${TAILSCALE_MAC_IP:-}" ]; then
  registration_url="http://${TAILSCALE_MAC_IP}:31415/sync/node-mac"
fi

if [ -n "$registration_url" ]; then
  set_prop "$ENGINE_FILE" "registration.url" "$registration_url"
fi

echo "Starting SymmetricDS engine '${ENGINE_NAME}' on HTTP port ${http_port}"
exec "${SYM_HOME}/bin/sym" "$@"
