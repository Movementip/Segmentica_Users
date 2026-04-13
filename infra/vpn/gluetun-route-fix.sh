#!/bin/sh
set -eu

/gluetun-entrypoint &
gluetun_pid="$!"

(
  while kill -0 "$gluetun_pid" 2>/dev/null; do
    if ip link show tun0 >/dev/null 2>&1; then
      ip route replace 10.13.13.0/24 dev tun0 2>/dev/null || true
      ip route replace 10.13.13.0/24 dev tun0 table 199 2>/dev/null || true
    fi
    sleep 2
  done
) &
route_pid="$!"

trap 'kill "$gluetun_pid" "$route_pid" 2>/dev/null || true' INT TERM
wait "$gluetun_pid"
