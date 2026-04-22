#!/bin/sh

set -a
if [ -f .env.local ]; then
    . ./.env.local
fi
set +a

BACKEND_PORT="${BACKEND_PORT:-3001}"
DOCUMENT_RENDERER_URL="${DOCUMENT_RENDERER_URL:-http://127.0.0.1:3010}"
NEXTAUTH_URL="${NEXTAUTH_URL:-http://localhost:3000}"

export PORT="$BACKEND_PORT"
export DOCUMENT_RENDERER_URL
export NEXTAUTH_URL

cd backend || exit 1

if [ "$1" = "--inspect" ]; then
    NODE_OPTIONS='--inspect' ../node_modules/.bin/next dev -p "$BACKEND_PORT"
else
    ../node_modules/.bin/next dev -p "$BACKEND_PORT"
fi
