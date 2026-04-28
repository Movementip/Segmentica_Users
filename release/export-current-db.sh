#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
DIST_DIR="$ROOT_DIR/release/dist"
OUT_FILE="${SEGMENTICA_DB_DUMP_OUT:-$DIST_DIR/Segmentica.dump}"
DB_CONTAINER="${SEGMENTICA_DB_CONTAINER:-segmentica-postgres}"
DB_NAME="${POSTGRES_DB:-Segmentica}"
DB_USER="${POSTGRES_USER:-postgres}"
CONTAINER_DUMP="/tmp/Segmentica.dump"

mkdir -p "$DIST_DIR"

echo "Экспортирую текущую базу $DB_NAME из контейнера $DB_CONTAINER..."
docker exec "$DB_CONTAINER" pg_dump \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -F c \
  -f "$CONTAINER_DUMP"

docker cp "$DB_CONTAINER:$CONTAINER_DUMP" "$OUT_FILE"
docker exec "$DB_CONTAINER" rm -f "$CONTAINER_DUMP"

echo "Готово: $OUT_FILE"
