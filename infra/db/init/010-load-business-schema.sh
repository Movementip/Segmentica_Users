#!/usr/bin/env bash
set -euo pipefail

psql -v ON_ERROR_STOP=1 \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    --file /docker-schema/Segmentica-public-business-schema.sql
