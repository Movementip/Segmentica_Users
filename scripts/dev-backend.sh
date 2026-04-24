#!/bin/sh

set -a
if [ -f .env.local ]; then
    . ./.env.local
fi
set +a

BACKEND_PORT="${BACKEND_PORT:-3001}"
DOCUMENT_RENDERER_URL="${DOCUMENT_RENDERER_URL:-http://127.0.0.1:3010}"
DOCUMENT_RENDERER_FALLBACK_URLS="${DOCUMENT_RENDERER_FALLBACK_URLS:-http://localhost:3010,http://host.docker.internal:3010,http://127.0.0.1:3001,http://localhost:3001,http://host.docker.internal:3001}"
NEXTAUTH_URL="${NEXTAUTH_URL:-http://localhost:3000}"

export PORT="$BACKEND_PORT"
export DOCUMENT_RENDERER_URL
export DOCUMENT_RENDERER_FALLBACK_URLS
export NEXTAUTH_URL

if [ -x "backend/node_modules/.bin/next" ]; then
    if [ "$1" = "--inspect" ]; then
        NODE_OPTIONS='--inspect' npm --prefix backend run dev
    else
        npm --prefix backend run dev
    fi
    exit $?
fi

printf 'backend/node_modules not found. Run: npm --prefix backend install\n' >&2
exit 1
