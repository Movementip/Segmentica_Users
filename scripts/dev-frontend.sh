#!/bin/sh

set -a
if [ -f .env.local ]; then
    . ./.env.local
fi
set +a

FRONTEND_PORT="${FRONTEND_PORT:-3000}"
BACKEND_PORT="${BACKEND_PORT:-3001}"
FRONTEND_API_INTERNAL_URL="${FRONTEND_API_INTERNAL_URL:-http://127.0.0.1:$BACKEND_PORT}"
NEXTAUTH_URL="${NEXTAUTH_URL:-http://localhost:$FRONTEND_PORT}"

export PORT="$FRONTEND_PORT"
export FRONTEND_API_INTERNAL_URL
export NEXTAUTH_URL

cd frontend || exit 1
npm run dev
