#!/bin/sh

cleanup() {
    if [ -n "$backend_pid" ]; then
        kill "$backend_pid" >/dev/null 2>&1 || true
    fi
    if [ -n "$frontend_pid" ]; then
        kill "$frontend_pid" >/dev/null 2>&1 || true
    fi

    printf '\nCleaning Next.js development caches...\n'
    rm -rf backend/.next/cache backend/.next/trace frontend/.next/cache frontend/.next/trace
    npm cache verify >/dev/null 2>&1 || true
}

pick_port() {
    port="$1"
    while lsof -n -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; do
        port=$((port + 1))
    done
    printf '%s' "$port"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

FRONTEND_PORT="${FRONTEND_PORT:-$(pick_port 3000)}"
BACKEND_PORT="${BACKEND_PORT:-$(pick_port 3001)}"

if [ "$BACKEND_PORT" = "$FRONTEND_PORT" ]; then
    BACKEND_PORT="$(pick_port $((BACKEND_PORT + 1)))"
fi

FRONTEND_API_INTERNAL_URL="${FRONTEND_API_INTERNAL_URL:-http://127.0.0.1:$BACKEND_PORT}"

export FRONTEND_PORT
export BACKEND_PORT
export FRONTEND_API_INTERNAL_URL

printf 'Frontend dev server: http://localhost:%s\n' "$FRONTEND_PORT"
printf 'Backend dev server:  http://localhost:%s\n' "$BACKEND_PORT"

sh scripts/dev-backend.sh &
backend_pid=$!

sh scripts/dev-frontend.sh &
frontend_pid=$!

while kill -0 "$backend_pid" >/dev/null 2>&1 && kill -0 "$frontend_pid" >/dev/null 2>&1; do
    sleep 1
done

wait "$backend_pid" >/dev/null 2>&1 || true
wait "$frontend_pid" >/dev/null 2>&1 || true
